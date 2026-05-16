export type SendPushInput = {
  userId: string;
  deviceId?: string;
  pushToken?: string | null;
  title: string;
  body?: string;
  data?: Record<string, string>;
};

export interface PushProvider {
  sendPush(input: SendPushInput): Promise<void>;
}
