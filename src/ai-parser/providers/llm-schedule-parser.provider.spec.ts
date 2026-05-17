import { ConfigService } from '@nestjs/config';
import { ScheduleItemType } from '@prisma/client';
import { LlmScheduleParserProvider } from './llm-schedule-parser.provider';

describe('LlmScheduleParserProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('calls SiliconFlow chat completions and parses the JSON response', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                itemType: 'REMINDER',
                title: 'Submit report',
                description: null,
                startTime: null,
                endTime: null,
                reminderTime: '2026-05-17T09:00:00+08:00',
                timezone: 'Asia/Shanghai',
                recurrenceRule: null,
                confidence: 0.92,
                needsConfirmation: false,
                question: null,
              }),
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new LlmScheduleParserProvider(configService());
    const result = await provider.parse({
      text: 'remind me to submit report tomorrow morning',
      timezone: 'Asia/Shanghai',
      locale: 'en',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.siliconflow.cn/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        }),
        body: expect.any(String),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('Pro/zai-org/GLM-4.7');
    expect(body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('remind me to submit report tomorrow morning'),
        }),
      ]),
    );
    expect(result).toEqual(
      expect.objectContaining({
        itemType: ScheduleItemType.REMINDER,
        title: 'Submit report',
        reminderTime: '2026-05-17T09:00:00+08:00',
        confidence: 0.92,
        needsConfirmation: false,
      }),
    );
  });

  it('returns the placeholder result when SiliconFlow is not enabled', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new LlmScheduleParserProvider(
      configService({
        'llm.provider': 'placeholder',
      }),
    );
    const result = await provider.parse({
      text: 'something vague',
      timezone: 'Asia/Shanghai',
      locale: 'en',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        itemType: ScheduleItemType.REMINDER,
        title: 'something vague',
        needsConfirmation: true,
      }),
    );
  });
});

function configService(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    'llm.provider': 'siliconflow',
    'llm.siliconFlow.apiKey': 'test-key',
    'llm.siliconFlow.baseUrl': 'https://api.siliconflow.cn/v1/chat/completions',
    'llm.siliconFlow.model': 'Pro/zai-org/GLM-4.7',
    'llm.siliconFlow.timeoutMs': 15000,
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
