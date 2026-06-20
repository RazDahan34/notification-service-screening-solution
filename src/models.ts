export interface TargetChannel {
  type: string;
  value: string;
}

export const PENDING = "pending";
export const PROCESSING = "processing";
export const SENT = "sent";
export const RETRY_PENDING = "retry_pending";
export const FAILED = "failed";

export class Notification {
  id: number;
  targetChannels: TargetChannel[];
  message: string;
  status: string;
  createdAt: Date;
  attempts: number;
  lastAttemptAt: Date | null;
  lastError: string | null;
  smsSegments: number;

  constructor(id: number, targetChannels: TargetChannel[], message: string) {
    this.id = id;
    this.targetChannels = targetChannels;
    this.message = message;
    this.status = PENDING;
    this.createdAt = new Date();
    this.attempts = 0;
    this.lastAttemptAt = null;
    this.lastError = null;
    this.smsSegments = 0;
  }
}
