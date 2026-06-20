import {
  Notification,
  PENDING,
  PROCESSING,
  SENT,
  FAILED,
  RETRY_PENDING,
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

type Outcome = "ok" | "temporary" | "permanent";

// Map a provider's Result to a delivery outcome. Anything that isn't an explicit
// success or a known-temporary failure is treated as permanent (fail closed).
function classify(result: string): Outcome {
  if (result === "Success") return "ok";
  if (result === "TemporaryFailure") return "temporary";
  return "permanent";
}

export class NotificationProcessor {
  constructor(private readonly providers: Record<string, Provider> = defaultProviders) {}

  sendOne(n: Notification): void {
    n.status = PROCESSING;
    n.attempts++;
    n.lastAttemptAt = new Date();

    if (n.targetChannels.length === 0) {
      n.status = FAILED;
      n.lastError = "No target channels";
      return;
    }

    let anyPermanent = false;
    const errors: string[] = [];

    // Attempt every channel, not just the first, and collect outcomes.
    for (const channel of n.targetChannels) {
      const provider = this.providers[channel.type];
      if (!provider) {
        anyPermanent = true;
        errors.push(`[${channel.type}] unknown channel type`);
        continue;
      }

      const response = provider({ recipient: channel.value, message: n.message });
      const outcome = classify(response.Result);
      if (outcome === "ok") continue;

      if (outcome === "permanent") anyPermanent = true;
      errors.push(`[${channel.type}] ${response.Message}`.trim());
    }

    if (errors.length === 0) {
      n.status = SENT;
      n.lastError = null;
    } else {
      // Permanent failures dominate: retrying can't fix a hard bounce, so the
      // notification is failed rather than parked for retry. Any error with no
      // permanent failure is temporary-only, hence retry_pending. (Trade-off
      // recorded in NOTES.md.)
      n.status = anyPermanent ? FAILED : RETRY_PENDING;
      n.lastError = errors.join(" | ");
    }
  }

  sendAll(): void {
    // Drain both fresh and retry-eligible notifications.
    const due = storage
      .getAll()
      .filter((n) => n.status === PENDING || n.status === RETRY_PENDING);
    for (const n of due) {
      this.sendOne(n);
    }
  }
}
