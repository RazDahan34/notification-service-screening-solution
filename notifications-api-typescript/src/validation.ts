import type { TargetChannel } from "./models.js";

// Tiny result type so routes can branch on validity without throwing.
export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateMessage(input: unknown): Validated<string> {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "message must be a non-empty string" };
  }
  return { ok: true, value: input };
}

export function validateChannels(input: unknown): Validated<TargetChannel[]> {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "targetChannels must be a non-empty array" };
  }
  const channels: TargetChannel[] = [];
  for (const c of input) {
    const type = (c as Record<string, unknown> | null)?.type;
    const value = (c as Record<string, unknown> | null)?.value;
    if (
      typeof type !== "string" ||
      type.trim() === "" ||
      typeof value !== "string" ||
      value.trim() === ""
    ) {
      return {
        ok: false,
        error: "each channel needs a non-empty string type and value",
      };
    }
    // Whitelist the shape — never carry extra client-supplied fields through.
    channels.push({ type, value });
  }
  return { ok: true, value: channels };
}

export interface CreateBody {
  message: string;
  targetChannels: TargetChannel[];
}

export function validateCreate(body: unknown): Validated<CreateBody> {
  const b = (body ?? {}) as Record<string, unknown>;
  const message = validateMessage(b.message);
  if (!message.ok) return message;
  const channels = validateChannels(b.targetChannels);
  if (!channels.ok) return channels;
  return { ok: true, value: { message: message.value, targetChannels: channels.value } };
}
