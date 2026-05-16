import { Injectable, Logger } from '@nestjs/common';
import { PushProvider, SendPushInput } from './push-provider.interface';

@Injectable()
export class ApnsPushProvider implements PushProvider {
  private readonly logger = new Logger(ApnsPushProvider.name);

  async sendPush(input: SendPushInput): Promise<void> {
    // TODO: Wire APNs token/certificate auth for production iOS push delivery.
    this.logger.log(`APNs placeholder sent for user=${input.userId} device=${input.deviceId ?? 'none'}`);
  }
}
