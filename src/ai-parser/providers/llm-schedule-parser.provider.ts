import { Injectable } from '@nestjs/common';
import {
  ParseScheduleInput,
  RawParsedScheduleResult,
  ScheduleParserProvider,
} from '../ai-parser.types';

@Injectable()
export class LlmScheduleParserProvider implements ScheduleParserProvider {
  async parse(input: ParseScheduleInput): Promise<RawParsedScheduleResult | null> {
    // TODO: Route through an OpenAI-compatible interface or China-hosted LLM provider.
    // Keep this behind the provider contract so deployments can use Tencent Cloud, Alibaba Cloud,
    // Baidu Qianfan, Moonshot, DeepSeek, or other approved providers without changing controllers.
    return {
      itemType: 'REMINDER',
      title: input.text.trim(),
      description: null,
      startTime: null,
      endTime: null,
      reminderTime: null,
      timezone: input.timezone,
      recurrenceRule: null,
      confidence: 0.35,
      needsConfirmation: true,
      question: 'When should I remind you?',
    };
  }
}
