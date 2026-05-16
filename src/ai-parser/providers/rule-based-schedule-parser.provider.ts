import { Injectable } from '@nestjs/common';
import { ScheduleItemType } from '@prisma/client';
import { DateTime } from 'luxon';
import {
  ParseScheduleInput,
  RawParsedScheduleResult,
  ScheduleParserProvider,
} from '../ai-parser.types';

const WEEKDAYS: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const WEEKDAY_RRULE: Record<string, string> = {
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
  sunday: 'SU',
};

@Injectable()
export class RuleBasedScheduleParserProvider implements ScheduleParserProvider {
  async parse(input: ParseScheduleInput): Promise<RawParsedScheduleResult | null> {
    const text = input.text.trim();
    const lower = text.toLowerCase();
    const now = DateTime.now().setZone(input.timezone);

    const monthly = this.parseMonthly(lower, now);
    if (monthly) {
      return this.buildReminder(text, input.timezone, monthly.time, monthly.recurrenceRule, 0.86);
    }

    const relative = this.parseRelative(lower, now);
    if (relative) {
      return this.buildReminder(text, input.timezone, relative, null, 0.9);
    }

    const weekly = this.parseWeekly(lower, now);
    const date = this.parseDate(lower, now);
    const parsedTime = this.parseTime(lower);

    const isEvent = this.looksLikeEvent(lower);
    const isReminder = this.looksLikeReminder(lower) || (!isEvent && Boolean(date || weekly));
    const targetDate = weekly?.time ?? date;

    if (isEvent && targetDate) {
      const start = this.applyTime(targetDate, parsedTime, this.defaultEventHour(lower));
      const end = start.plus({ hours: lower.includes('dinner') ? 2 : 1 });
      return {
        itemType: ScheduleItemType.EVENT,
        title: this.titleize(this.cleanTitle(text)),
        description: null,
        startTime: this.toIso(start),
        endTime: this.toIso(end),
        reminderTime: null,
        timezone: input.timezone,
        recurrenceRule: weekly?.recurrenceRule ?? null,
        confidence: parsedTime.hasTime || lower.includes('dinner') ? 0.84 : 0.72,
        needsConfirmation: false,
        question: null,
      };
    }

    if (isReminder && targetDate) {
      const reminderTime = this.applyTime(targetDate, parsedTime, 9);
      return this.buildReminder(
        text,
        input.timezone,
        reminderTime,
        weekly?.recurrenceRule ?? null,
        parsedTime.hasTime ? 0.91 : 0.76,
      );
    }

    return null;
  }

  private parseRelative(lower: string, now: DateTime): DateTime | null {
    const match = lower.match(/\bin\s+(\d{1,4})\s+(minute|minutes|hour|hours|day|days)\b/);
    if (!match) {
      return null;
    }

    const amount = Number(match[1]);
    const unit = match[2].startsWith('minute')
      ? 'minutes'
      : match[2].startsWith('hour')
        ? 'hours'
        : 'days';
    return now.plus({ [unit]: amount }).set({ second: 0, millisecond: 0 });
  }

  private parseMonthly(lower: string, now: DateTime) {
    const match = lower.match(/\bevery\s+month\s+on\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    if (day < 1 || day > 31) {
      return null;
    }

    let candidate = now.set({
      day: Math.min(day, now.daysInMonth ?? 31),
      hour: 9,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    if (candidate <= now) {
      const next = now.plus({ months: 1 });
      candidate = next.set({
        day: Math.min(day, next.daysInMonth ?? 31),
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
    }

    return {
      time: candidate,
      recurrenceRule: `FREQ=MONTHLY;BYMONTHDAY=${day}`,
    };
  }

  private parseWeekly(lower: string, now: DateTime) {
    const match = lower.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (!match) {
      return null;
    }

    const weekday = match[1];
    return {
      time: this.nextWeekday(now, WEEKDAYS[weekday]),
      recurrenceRule: `FREQ=WEEKLY;BYDAY=${WEEKDAY_RRULE[weekday]}`,
    };
  }

  private parseDate(lower: string, now: DateTime): DateTime | null {
    if (lower.includes('tomorrow')) {
      return now.plus({ days: 1 }).startOf('day');
    }

    if (lower.includes('today')) {
      return now.startOf('day');
    }

    const nextMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (nextMatch) {
      return this.nextWeekday(now, WEEKDAYS[nextMatch[1]]);
    }

    return null;
  }

  private parseTime(lower: string): { hour: number; minute: number; hasTime: boolean } {
    const match =
      lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/) ??
      lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);

    if (!match) {
      return { hour: 9, minute: 0, hasTime: false };
    }

    let hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    const meridiem = match[3];

    if (meridiem === 'pm' && hour < 12) {
      hour += 12;
    }

    if (meridiem === 'am' && hour === 12) {
      hour = 0;
    }

    if (hour > 23 || minute > 59) {
      return { hour: 9, minute: 0, hasTime: false };
    }

    return { hour, minute, hasTime: true };
  }

  private looksLikeReminder(lower: string): boolean {
    return /\b(remind|pay|submit|call|buy|renew|take)\b/.test(lower);
  }

  private looksLikeEvent(lower: string): boolean {
    return /\b(dinner|lunch|breakfast|meeting|appointment|coffee|interview|class|workout)\b/.test(lower);
  }

  private defaultEventHour(lower: string): number {
    if (lower.includes('dinner')) {
      return 19;
    }

    if (lower.includes('lunch')) {
      return 12;
    }

    return 9;
  }

  private buildReminder(
    text: string,
    timezone: string,
    reminderTime: DateTime,
    recurrenceRule: string | null,
    confidence: number,
  ): RawParsedScheduleResult {
    return {
      itemType: ScheduleItemType.REMINDER,
      title: this.titleize(this.cleanTitle(text)),
      description: null,
      startTime: null,
      endTime: null,
      reminderTime: this.toIso(reminderTime),
      timezone,
      recurrenceRule,
      confidence,
      needsConfirmation: false,
      question: null,
    };
  }

  private nextWeekday(now: DateTime, targetWeekday: number): DateTime {
    const daysAhead = (targetWeekday - now.weekday + 7) % 7 || 7;
    return now.plus({ days: daysAhead }).startOf('day');
  }

  private applyTime(
    date: DateTime,
    parsedTime: { hour: number; minute: number; hasTime: boolean },
    defaultHour: number,
  ): DateTime {
    return date.set({
      hour: parsedTime.hasTime ? parsedTime.hour : defaultHour,
      minute: parsedTime.hasTime ? parsedTime.minute : 0,
      second: 0,
      millisecond: 0,
    });
  }

  private cleanTitle(text: string): string {
    return text
      .replace(/\bplease\b/gi, '')
      .replace(/\bremind me to\b/gi, '')
      .replace(/\bremind me\b/gi, '')
      .replace(/\bin\s+\d{1,4}\s+(minute|minutes|hour|hours|day|days)\b/gi, '')
      .replace(/\bevery\s+month\s+on\s+the\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, '')
      .replace(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .replace(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .replace(/\btomorrow\b/gi, '')
      .replace(/\btoday\b/gi, '')
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
      .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private titleize(value: string): string {
    const title = value || 'Reminder';
    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  private toIso(value: DateTime): string {
    return value.toISO({ suppressMilliseconds: true }) ?? value.toUTC().toISO() ?? value.toJSDate().toISOString();
  }
}
