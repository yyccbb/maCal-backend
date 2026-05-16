import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: '8f1f3e5f-77c4-4a7d-b9d3-6e75d9d5e5a1',
    account: 'demo',
    displayName: 'Demo User',
    locale: 'en',
    timezone: 'Asia/Shanghai',
    passwordHash: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };
  const readConfig = (key: string) => {
      const values: Record<string, unknown> = {
        'jwt.accessSecret': 'access-secret-access-secret-access-secret',
        'jwt.refreshSecret': 'refresh-secret-refresh-secret-refresh-secret',
        'jwt.accessTtl': '15m',
        'jwt.refreshTtlDays': 30,
      };
      return values[key];
  };
  const config = {
    get: jest.fn(readConfig),
    getOrThrow: jest.fn(readConfig),
  };

  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    user.passwordHash = await bcrypt.hash('DemoPassword123!', 4);
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.refreshToken.create.mockResolvedValue({});
    jwtService.signAsync.mockResolvedValueOnce('access-token').mockResolvedValueOnce('refresh-token');
    service = new AuthService(prisma as any, jwtService as any, config as any);
  });

  it('logs in with account and password', async () => {
    const result = await service.login('demo', 'DemoPassword123!');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toMatchObject({
      account: 'demo',
      displayName: 'Demo User',
      timezone: 'Asia/Shanghai',
    });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('rejects an invalid password', async () => {
    await expect(service.login('demo', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
