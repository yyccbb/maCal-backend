import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).default(30),
  CORS_ORIGIN: Joi.string().allow('').default(''),
  AUTH_THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().min(1).default(10),
  AI_THROTTLE_TTL_MS: Joi.number().integer().min(1000).default(60000),
  AI_THROTTLE_LIMIT: Joi.number().integer().min(1).default(30),
  DEFAULT_LOCALE: Joi.string().default('en'),
  DEFAULT_TIMEZONE: Joi.string().default('Asia/Shanghai'),
  LLM_PROVIDER: Joi.string().default('placeholder'),
  SMS_PROVIDER: Joi.string().default('placeholder'),
  OBJECT_STORAGE_PROVIDER: Joi.string().default('placeholder'),
});
