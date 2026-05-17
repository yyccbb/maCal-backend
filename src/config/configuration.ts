export default () => ({
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  defaults: {
    locale: process.env.DEFAULT_LOCALE ?? 'en',
    timezone: process.env.DEFAULT_TIMEZONE ?? 'Asia/Shanghai',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  providers: {
    llm: process.env.LLM_PROVIDER ?? 'placeholder',
    sms: process.env.SMS_PROVIDER ?? 'placeholder',
    objectStorage: process.env.OBJECT_STORAGE_PROVIDER ?? 'placeholder',
  },
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'placeholder',
    siliconFlow: {
      baseUrl: process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1/chat/completions',
      apiKey: process.env.SILICONFLOW_API_KEY || undefined,
      model: process.env.SILICONFLOW_MODEL ?? 'Pro/zai-org/GLM-4.7',
      timeoutMs: Number(process.env.SILICONFLOW_TIMEOUT_MS ?? 15000),
    },
  },
});
