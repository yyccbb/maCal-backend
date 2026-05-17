import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import {
  ParseScheduleInput,
  RawParsedScheduleResult,
  ScheduleParserProvider,
} from '../ai-parser.types';

type SiliconFlowChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

@Injectable()
export class LlmScheduleParserProvider implements ScheduleParserProvider {
  private readonly logger = new Logger(LlmScheduleParserProvider.name);

  constructor(private readonly config: ConfigService) {}

  async parse(input: ParseScheduleInput): Promise<RawParsedScheduleResult | null> {
    const provider = this.config.get<string>('llm.provider') ?? 'placeholder';
    if (provider !== 'siliconflow') {
      return this.placeholderResult(input);
    }

    const apiKey = this.config.get<string>('llm.siliconFlow.apiKey');
    if (!apiKey) {
      this.logger.warn('SiliconFlow LLM provider is enabled but SILICONFLOW_API_KEY is missing');
      return this.placeholderResult(input);
    }

    const baseUrl =
      this.config.get<string>('llm.siliconFlow.baseUrl') ??
      'https://api.siliconflow.cn/v1/chat/completions';
    const model = this.config.get<string>('llm.siliconFlow.model') ?? 'Pro/zai-org/GLM-4.7';
    const timeoutMs = this.config.get<number>('llm.siliconFlow.timeoutMs') ?? 15000;
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), timeoutMs);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: this.systemPrompt() },
            { role: 'user', content: this.userPrompt(input) },
          ],
          temperature: 0.1,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const responseBody = await response.text();
        this.logger.warn(
          `SiliconFlow parser request failed with ${response.status}: ${responseBody.slice(0, 240)}`,
        );
        return null;
      }

      const data = (await response.json()) as SiliconFlowChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn('SiliconFlow parser response did not include message content');
        return null;
      }

      return this.parseModelContent(content, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SiliconFlow parser request failed: ${message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private systemPrompt(): string {
    return [
      'You are a strict calendar and reminder parsing engine.',
      'Return exactly one valid JSON object and no markdown, comments, or extra text.',
      'The request may be in any language. Preserve meaningful user wording in the title.',
      'Use the provided currentTime and timezone to resolve relative dates.',
      'Use ISO 8601 datetimes with timezone offsets. If a value is unknown, use null.',
      'Use RRULE strings like FREQ=WEEKLY;BYDAY=MO for recurrenceRule, or null when not recurring.',
      'Set needsConfirmation to true when required date/time details are ambiguous or missing.',
      'Schema: {"itemType":"EVENT|REMINDER","title":"string","description":null,"startTime":null,"endTime":null,"reminderTime":null,"timezone":"string","recurrenceRule":null,"confidence":0.0,"needsConfirmation":false,"question":null}',
    ].join('\n');
  }

  private userPrompt(input: ParseScheduleInput): string {
    const currentTime = DateTime.now().setZone(input.timezone).toISO({ suppressMilliseconds: true });
    return [
      'Parse this schedule request into the required JSON schema.',
      JSON.stringify(
        {
          text: input.text,
          timezone: input.timezone,
          locale: input.locale,
          currentTime,
        },
        null,
        2,
      ),
    ].join('\n');
  }

  private parseModelContent(content: string, input: ParseScheduleInput): RawParsedScheduleResult | null {
    const jsonText = this.extractJson(content);
    if (!jsonText) {
      this.logger.warn('SiliconFlow parser response did not contain JSON');
      return null;
    }

    try {
      const parsed = JSON.parse(jsonText) as unknown;
      return this.toRawParsedScheduleResult(parsed, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SiliconFlow parser returned invalid JSON: ${message}`);
      return null;
    }
  }

  private extractJson(content: string): string | null {
    const trimmed = content.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return fenced[1].trim();
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) {
      return null;
    }

    return trimmed.slice(start, end + 1);
  }

  private toRawParsedScheduleResult(
    value: unknown,
    input: ParseScheduleInput,
  ): RawParsedScheduleResult | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const confidence = Number(value.confidence ?? 0.5);
    if (!Number.isFinite(confidence)) {
      return null;
    }

    return {
      itemType: typeof value.itemType === 'string' ? value.itemType : 'REMINDER',
      title: this.stringOrFallback(value.title, input.text),
      description: this.nullableString(value.description),
      startTime: this.nullableString(value.startTime),
      endTime: this.nullableString(value.endTime),
      reminderTime: this.nullableString(value.reminderTime),
      timezone: input.timezone,
      recurrenceRule: this.nullableString(value.recurrenceRule),
      confidence,
      needsConfirmation:
        typeof value.needsConfirmation === 'boolean' ? value.needsConfirmation : confidence < 0.7,
      question: this.nullableString(value.question),
    };
  }

  private stringOrFallback(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    return fallback.trim();
  }

  private nullableString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null') {
      return null;
    }

    return trimmed;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private placeholderResult(input: ParseScheduleInput): RawParsedScheduleResult {
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
