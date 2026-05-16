import { BadRequestException, Injectable } from '@nestjs/common';
import { ScheduleItemType } from '@prisma/client';
import { DateTime } from 'luxon';
import {
  ParseScheduleInput,
  ParsedScheduleResult,
  RawParsedScheduleResult,
} from './ai-parser.types';
import { LlmScheduleParserProvider } from './providers/llm-schedule-parser.provider';
import { RuleBasedScheduleParserProvider } from './providers/rule-based-schedule-parser.provider';

@Injectable()
export class AiParserService {
  constructor(
    private readonly ruleBasedParser: RuleBasedScheduleParserProvider,
    private readonly llmParser: LlmScheduleParserProvider,
  ) {}

  async parse(input: ParseScheduleInput): Promise<ParsedScheduleResult> {
    const ruleResult = await this.ruleBasedParser.parse(input);
    const raw = ruleResult ?? (await this.llmParser.parse(input));

    if (!raw) {
      return this.uncertainReminder(input, 'What time should I use?');
    }

    return this.normalize(raw, input);
  }

  private normalize(raw: RawParsedScheduleResult, input: ParseScheduleInput): ParsedScheduleResult {
    const type = this.normalizeType(raw.itemType);
    const confidence = this.clampConfidence(raw.confidence);
    const result: ParsedScheduleResult = {
      itemType: type,
      title: this.normalizeTitle(raw.title, input.text),
      description: raw.description ?? null,
      startTime: this.normalizeIso(raw.startTime, input.timezone, 'startTime'),
      endTime: this.normalizeIso(raw.endTime, input.timezone, 'endTime'),
      reminderTime: this.normalizeIso(raw.reminderTime, input.timezone, 'reminderTime'),
      timezone: input.timezone,
      recurrenceRule: raw.recurrenceRule ?? null,
      confidence,
      needsConfirmation: raw.needsConfirmation || confidence < 0.7,
      question: raw.question ?? null,
    };

    if (result.itemType === ScheduleItemType.REMINDER && !result.reminderTime) {
      result.needsConfirmation = true;
      result.question = result.question ?? 'When should I remind you?';
    }

    if (result.itemType === ScheduleItemType.EVENT) {
      if (!result.startTime || !result.endTime) {
        result.needsConfirmation = true;
        result.question = result.question ?? 'What start and end time should I use?';
      } else if (new Date(result.endTime) <= new Date(result.startTime)) {
        result.needsConfirmation = true;
        result.question = 'The end time must be after the start time. What time should the event end?';
      }
    }

    return result;
  }

  private normalizeType(value: string): ScheduleItemType {
    const normalized = value.toUpperCase();
    if (normalized === ScheduleItemType.EVENT) {
      return ScheduleItemType.EVENT;
    }

    if (normalized === ScheduleItemType.REMINDER) {
      return ScheduleItemType.REMINDER;
    }

    return ScheduleItemType.REMINDER;
  }

  private normalizeTitle(title: string | null | undefined, fallback: string): string {
    const normalized = (title ?? fallback).trim();
    if (!normalized) {
      throw new BadRequestException('Parsed title cannot be empty');
    }

    return normalized.slice(0, 160);
  }

  private normalizeIso(value: string | null, timezone: string, fieldName: string): string | null {
    if (!value) {
      return null;
    }

    const dateTime = DateTime.fromISO(value, { zone: timezone });
    if (!dateTime.isValid) {
      throw new BadRequestException(`${fieldName} from parser is not a valid ISO datetime`);
    }

    return dateTime.setZone(timezone).toISO({ suppressMilliseconds: true });
  }

  private clampConfidence(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(1, Math.max(0, Number(value.toFixed(2))));
  }

  private uncertainReminder(input: ParseScheduleInput, question: string): ParsedScheduleResult {
    return {
      itemType: ScheduleItemType.REMINDER,
      title: input.text.trim().slice(0, 160),
      description: null,
      startTime: null,
      endTime: null,
      reminderTime: null,
      timezone: input.timezone,
      recurrenceRule: null,
      confidence: 0.25,
      needsConfirmation: true,
      question,
    };
  }
}
