import { ConfigService } from '@nestjs/config';
import { ScheduleItemType } from '@prisma/client';
import { AiParserService } from './ai-parser.service';
import { LlmScheduleParserProvider } from './providers/llm-schedule-parser.provider';
import { RuleBasedScheduleParserProvider } from './providers/rule-based-schedule-parser.provider';

describe('AiParserService', () => {
  let service: AiParserService;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string) => (key === 'llm.provider' ? 'placeholder' : undefined)),
    } as unknown as ConfigService;

    service = new AiParserService(
      new RuleBasedScheduleParserProvider(),
      new LlmScheduleParserProvider(config),
    );
  });

  it('parses a natural language reminder', async () => {
    const result = await service.parse({
      text: 'remind me to call mom tomorrow at 7pm',
      timezone: 'Asia/Shanghai',
      locale: 'en',
    });

    expect(result.itemType).toBe(ScheduleItemType.REMINDER);
    expect(result.title).toBe('Call mom');
    expect(result.reminderTime).toContain('T19:00:00');
    expect(result.needsConfirmation).toBe(false);
  });

  it('parses a natural language event', async () => {
    const result = await service.parse({
      text: 'dinner with Alex next Friday',
      timezone: 'Asia/Shanghai',
      locale: 'en',
    });

    expect(result.itemType).toBe(ScheduleItemType.EVENT);
    expect(result.title).toBe('Dinner with Alex');
    expect(result.startTime).toContain('T19:00:00');
    expect(result.endTime).toContain('T21:00:00');
  });
});
