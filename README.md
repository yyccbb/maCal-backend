# MaCal Backend MVP

NestJS + PostgreSQL + Prisma + Redis/BullMQ backend skeleton for a calendar and reminder app.

## What Is Included

- Test-account auth only: `account` + `password`
- JWT access tokens and rotated hashed refresh tokens
- User-scoped calendars, schedule items, devices, notifications, and sync
- Schedule items limited to `EVENT` and `REMINDER`
- Natural language parsing endpoint that returns structured data without saving it
- Rule-based parser plus an LLM provider placeholder
- BullMQ `reminders` queue with push provider placeholders
- China-compatible extension points for APNs, web push, Tencent/JPush/OEM push, SMS, LLM, and object storage
- Health check for API, PostgreSQL, and Redis

There is intentionally no public registration, email login, phone/SMS login, OAuth, verification, or password reset endpoint in this MVP.

## Setup

```bash
cp .env.example .env
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

The API starts on `http://localhost:3000` by default.

## Environment

Key variables:

```bash
DATABASE_URL=postgresql://macal:macal_password@localhost:5432/macal?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret
JWT_REFRESH_SECRET=replace-with-a-long-random-refresh-secret
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
DEFAULT_TIMEZONE=Asia/Shanghai
LLM_PROVIDER=placeholder
SMS_PROVIDER=placeholder
OBJECT_STORAGE_PROVIDER=placeholder
```

## Scripts

```bash
npm run start:dev
npm run build
npm test
npm run test:e2e
npm run lint
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

`npm test` runs unit tests. `npm run test:e2e` expects PostgreSQL and Redis to be running.

## Test Accounts

Created by `npm run prisma:seed`:

| Account | Password | Display name |
| --- | --- | --- |
| `testuser1` | `TestPassword123!` | Test User 1 |
| `testuser2` | `TestPassword123!` | Test User 2 |
| `demo` | `DemoPassword123!` | Demo User |

Passwords are hashed before being stored.

## API Examples

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"account":"demo","password":"DemoPassword123!"}'
```

Use the returned access token:

```bash
export TOKEN='paste-access-token-here'
```

Create a reminder:

```bash
curl -X POST http://localhost:3000/schedule-items \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "REMINDER",
    "title": "Submit homework",
    "reminderTime": "2026-05-14T20:00:00+08:00",
    "timezone": "Asia/Shanghai"
  }'
```

Create an event:

```bash
curl -X POST http://localhost:3000/schedule-items \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "EVENT",
    "title": "Dinner with Alex",
    "startTime": "2026-05-15T19:00:00+08:00",
    "endTime": "2026-05-15T21:00:00+08:00",
    "timezone": "Asia/Shanghai"
  }'
```

Parse natural language:

```bash
curl -X POST http://localhost:3000/ai/parse-schedule-text \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "remind me to call mom tomorrow at 7pm",
    "timezone": "Asia/Shanghai",
    "locale": "en"
  }'
```

List sync changes:

```bash
curl "http://localhost:3000/sync?sinceVersion=0" \
  -H "Authorization: Bearer $TOKEN"
```

Health:

```bash
curl http://localhost:3000/health
```

## Notes For Future Production Work

- Replace placeholder push providers with APNs, web push, and China-compatible mobile push providers.
- Keep push provider choice configurable; do not make Firebase or any single provider mandatory.
- Replace the LLM placeholder through `ScheduleParserProvider`; the service already validates and normalizes provider output before returning it.
- Add admin-only account creation when ready. Public self-registration is intentionally absent from the MVP.
