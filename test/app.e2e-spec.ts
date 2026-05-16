import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ScheduleItemType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MaCal API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let refreshToken: string;
  let calendarId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://macal:macal_password@localhost:5432/macal?schema=public';
    process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
    process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-test-access-secret';
    process.env.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-test-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { account: 'demo' } });
    const user = await prisma.user.create({
      data: {
        account: 'demo',
        passwordHash: await bcrypt.hash('DemoPassword123!', 4),
        displayName: 'Demo User',
        locale: 'en',
        timezone: 'Asia/Shanghai',
      },
    });
    const calendar = await prisma.calendar.create({
      data: {
        userId: user.id,
        name: 'Default',
        color: '#2F80ED',
        isDefault: true,
      },
    });
    calendarId = calendar.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with a seeded test account', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ account: 'demo', password: 'DemoPassword123!' })
      .expect(201);

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
    expect(response.body.user.account).toBe('demo');
  });

  it('refreshes a token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
    expect(accessToken).toBeTruthy();
  });

  it('creates a reminder', async () => {
    const response = await request(app.getHttpServer())
      .post('/schedule-items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: ScheduleItemType.REMINDER,
        title: 'Call mom',
        calendarId,
        reminderTime: '2026-05-14T19:00:00+08:00',
        timezone: 'Asia/Shanghai',
      })
      .expect(201);

    expect(response.body.type).toBe(ScheduleItemType.REMINDER);
    expect(response.body.reminderTime).toBeTruthy();
  });

  it('creates an event', async () => {
    const response = await request(app.getHttpServer())
      .post('/schedule-items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: ScheduleItemType.EVENT,
        title: 'Dinner with Alex',
        calendarId,
        startTime: '2026-05-15T19:00:00+08:00',
        endTime: '2026-05-15T21:00:00+08:00',
        timezone: 'Asia/Shanghai',
      })
      .expect(201);

    expect(response.body.type).toBe(ScheduleItemType.EVENT);
    expect(response.body.startTime).toBeTruthy();
  });

  it('rejects an invalid schedule item type', async () => {
    await request(app.getHttpServer())
      .post('/schedule-items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        type: 'TASK',
        title: 'Unsupported item',
        reminderTime: '2026-05-14T19:00:00+08:00',
        timezone: 'Asia/Shanghai',
      })
      .expect(400);
  });

  it('parses natural language reminder input', async () => {
    const response = await request(app.getHttpServer())
      .post('/ai/parse-schedule-text')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        text: 'remind me to call mom tomorrow at 7pm',
        timezone: 'Asia/Shanghai',
        locale: 'en',
      })
      .expect(201);

    expect(response.body.itemType).toBe(ScheduleItemType.REMINDER);
    expect(response.body.title).toBe('Call mom');
  });

  it('parses natural language event input', async () => {
    const response = await request(app.getHttpServer())
      .post('/ai/parse-schedule-text')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        text: 'dinner with Alex next Friday',
        timezone: 'Asia/Shanghai',
        locale: 'en',
      })
      .expect(201);

    expect(response.body.itemType).toBe(ScheduleItemType.EVENT);
    expect(response.body.title).toBe('Dinner with Alex');
  });
});
