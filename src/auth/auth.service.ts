import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type PublicUser = Pick<User, 'id' | 'account' | 'displayName' | 'locale' | 'timezone'>;

type RefreshPayload = {
  sub: string;
  jti: string;
  tokenType: 'refresh';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(account: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { account } });
    if (!user) {
      throw new UnauthorizedException('Invalid account or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid account or password');
    }

    const tokens = await this.issueTokenPair(user);
    return {
      ...tokens,
      user: this.toPublicUser(user),
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        id: payload.jti,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const matches = await bcrypt.compare(refreshToken, tokenRecord.tokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokenPair(tokenRecord.user);
    return {
      ...tokens,
      user: this.toPublicUser(tokenRecord.user),
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (!refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return { success: true };
    }

    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      if (payload.sub !== userId) {
        return { success: true };
      }

      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logout is intentionally idempotent and does not reveal token validity.
    }

    return { success: true };
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        account: true,
        displayName: true,
        locale: true,
        timezone: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }

  private async issueTokenPair(user: PublicUser) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        account: user.account,
        tokenType: 'access',
      },
      {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.accessTtl') as any,
      },
    );

    const refreshTokenId = randomUUID();
    const refreshTtlDays = this.config.get<number>('jwt.refreshTtlDays') ?? 30;
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        jti: refreshTokenId,
        tokenType: 'refresh',
      },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: `${refreshTtlDays}d`,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 12),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<RefreshPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  private toPublicUser(user: PublicUser): PublicUser {
    return {
      id: user.id,
      account: user.account,
      displayName: user.displayName,
      locale: user.locale,
      timezone: user.timezone,
    };
  }
}
