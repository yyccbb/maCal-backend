import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  register(userId: string, dto: RegisterDeviceDto) {
    // pushProvider is intentionally free-form so clients can report APNs, web push,
    // Tencent Push, JPush, Huawei/OEM push, or future regional providers.
    return this.prisma.device.create({
      data: {
        userId,
        platform: dto.platform,
        pushProvider: dto.pushProvider,
        pushToken: dto.pushToken,
        timezone: dto.timezone,
        appVersion: dto.appVersion,
        lastSeenAt: new Date(),
      },
    });
  }

  async remove(userId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await this.prisma.device.delete({ where: { id } });
    return { success: true };
  }
}
