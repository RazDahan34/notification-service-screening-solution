import {
  Notification,
  PENDING,
  PROCESSING,
  SENT,
  FAILED,
} from "./models.js";
import * as storage from "./storage.js";
import { send as sendEmail } from "./providers/emailProvider.js";
import { send as sendSms } from "./providers/smsProvider.js";
import { send as sendPush } from "./providers/pushProvider.js";

export interface ProviderRequest {
  recipient: string;
  message: string;
}

export interface ProviderResponse {
  Result: string;
  ErrorCode: string;
  Message: string;
}

// A provider is just a function from a request to a response. Modelling it as a
// registry (rather than a hardcoded if/else) keeps the processor open for new
// channels and lets tests inject deterministic fakes.
export type Provider = (req: ProviderRequest) => ProviderResponse;

export const defaultProviders: Record<string, Provider> = {
  email: sendEmail,
  sms: sendSms,
  push: sendPush,
};

export class NotificationProcessor {
  constructor(private readonly providers: Record<string, Provider> = defaultProviders) {}

  sendOne(n: Notification): void {
    n.status = PROCESSING;
    n.attempts++;
    n.lastAttemptAt = new Date();

    const target = n.targetChannels[0];
    if (!target) {
      n.status = FAILED;
      n.lastError = "No target channels";
      return;
    }

    const provider = this.providers[target.type];
    if (!provider) {
      n.status = FAILED;
      n.lastError = "Unknown channel";
      return;
    }

    const response = provider({ recipient: target.value, message: n.message });
    n.status = SENT;
    n.lastError = response.Message;
  }

  sendAll(): void {
    const pending = storage.getAll().filter((n) => n.status === PENDING);
    for (const n of pending) {
      this.sendOne(n);
    }
  }
}
