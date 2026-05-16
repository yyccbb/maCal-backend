import { Injectable, Logger } from '@nestjs/common';
import { PushProvider, SendPushInput } from './push-provider.interface';

@Injectable()
export class WebPushProvider implements PushProvider {
  private readonly logger = new Logger(WebPushProvider.name);

  async sendPush(input: SendPushInput): Promise<void> {
    // TODO: Add VAPID-based Web Push when the web client is ready.
    this.logger.log(`Web push placeholder sent for user=${input.userId} device=${input.deviceId ?? 'none'}`);
  }
}
