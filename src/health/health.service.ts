import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const checks = {
      api: { status: 'up' },
      postgres: await this.checkPostgres(),
      redis: await this.checkRedis(),
    };

    const isHealthy = Object.values(checks).every((check) => check.status === 'up');
    const body = {
      status: isHealthy ? 'ok' : 'error',
      checks,
      timestamp: new Date().toISOString(),
    };

    if (!isHealthy) {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }

  private async checkPostgres() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch {
      return { status: 'down' };
    }
  }

  private async checkRedis() {
    try {
      const pong = await this.redis.ping();
      return { status: pong === 'PONG' ? 'up' : 'down' };
    } catch {
      return { status: 'down' };
    }
  }
}
