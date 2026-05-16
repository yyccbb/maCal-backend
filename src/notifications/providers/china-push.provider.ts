import { Injectable, Logger } from '@nestjs/common';
import { PushProvider, SendPushInput } from './push-provider.interface';

@Injectable()
export class ChinaPushProvider implements PushProvider {
  private readonly logger = new Logger(ChinaPushProvider.name);

  async sendPush(input: SendPushInput): Promise<void> {
    // TODO: Add Tencent Push, JPush, Huawei/Oppo/Vivo/Xiaomi OEM push, or Alibaba Cloud Mobile Push here.
    this.logger.log(`China push placeholder sent for user=${input.userId} device=${input.deviceId ?? 'none'}`);
  }
}
