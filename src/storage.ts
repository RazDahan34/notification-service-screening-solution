import {
  Notification,
  TargetChannel,
  SENT,
  FAILED,
  RETRY_PENDING,
} from "./models.js";
import { minSmsSegments } from "./segmenter.js";

const notifications: Notification[] = [];
let nextId = 1;

export function addNotification(
  targetChannels: TargetChannel[],
  message: string
): Notification {
  const n = new Notification(nextId++, targetChannels, message);
  if (targetChannels.some((c) => c.type === "sms")) {
    n.smsSegments = minSmsSegments(message);
  }
  notifications.push(n);
  return n;
}

export function getAll(): Notification[] {
  return notifications;
}

export function findById(id: number): Notification | undefined {
  return notifications.find((n) => n.id === id);
}

export function seed(): void {
  notifications.length = 0;
  nextId = 1;

  const n1 = addNotification(
    [{ type: "email", value: "alice@example.com" }],
    "Welcome to the platform"
  );
  n1.status = SENT;
  n1.attempts = 1;
  n1.lastAttemptAt = new Date();
  n1.lastError = "[email] accepted for delivery";

  addNotification([{ type: "sms", value: "12345" }], "Short number");

  const n3 = addNotification(
    [{ type: "push", value: "device-abc" }],
    "Your ride is here"
  );
  n3.status = FAILED;
  n3.attempts = 1;
  n3.lastAttemptAt = new Date();
  n3.lastError = "[push] device token rejected";

  addNotification(
    [
      { type: "email", value: "bob@example.com" },
      { type: "sms", value: "+15551234567" },
    ],
    "2FA code 4242"
  );

  const n5 = addNotification(
    [
      { type: "sms", value: "+15559876543" },
      { type: "push", value: "device-xyz" },
      { type: "email", value: "carol@example.com" },
    ],
    "Order shipped"
  );
  n5.status = RETRY_PENDING;
  n5.attempts = 2;
  n5.lastAttemptAt = new Date();
  n5.lastError = "[sms] temporary outage, retry later";
}
