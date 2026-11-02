export const NOTIFICATION_SENDER = Symbol('NOTIFICATION_SENDER');

export interface NotificationMessage {
  title: string;
  body: string;
  /** Optional non-sensitive routing data; never shown on the lock screen. */
  data?: Record<string, string>;
}

export interface NotificationSendResult {
  token: string;
  success: boolean;
  /** True when the provider says the token can never be delivered to again. */
  invalidToken?: boolean;
  error?: string;
}

export interface NotificationSender {
  send(token: string, message: NotificationMessage): Promise<NotificationSendResult>;
}
