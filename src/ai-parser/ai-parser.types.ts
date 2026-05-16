import { ScheduleItemType } from '@prisma/client';

export type ParseScheduleInput = {
  text: string;
  timezone: string;
  locale: string;
};

export type ParsedScheduleResult = {
  itemType: ScheduleItemType;
  title: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  reminderTime: string | null;
  timezone: string;
  recurrenceRule: string | null;
  confidence: number;
  needsConfirmation: boolean;
  question: string | null;
};

export type RawParsedScheduleResult = Omit<ParsedScheduleResult, 'itemType'> & {
  itemType: string;
};

export interface ScheduleParserProvider {
  parse(input: ParseScheduleInput): Promise<RawParsedScheduleResult | null>;
}
