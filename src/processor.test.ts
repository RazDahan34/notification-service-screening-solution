import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NotificationProcessor,
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
} from "./processor.js";
import { Notification, SENT, FAILED, RETRY_PENDING } from "./models.js";

const reply = (Result: string, Message = Result): ProviderResponse => ({
  Result,
  ErrorCode: "",
  Message,
});
const ok: Provider = () => reply("Success", "delivered");
const temp: Provider = () => reply("TemporaryFailure", "temporary outage");
const perm: Provider = () => reply("PermanentFailure", "permanent failure");
const invalid: Provider = () => reply("InvalidRequest", "invalid recipient");

function spy(impl: Provider): { fn: Provider; calls: ProviderRequest[] } {
  const calls: ProviderRequest[] = [];
  const fn: Provider = (req) => {
    calls.push(req);
    return impl(req);
  };
  return { fn, calls };
}

const notif = (channels: { type: string; value: string }[], message = "hi") =>
  new Notification(1, channels, message);

test("delivers to every target channel, not just the first", () => {
  const email = spy(ok);
  const sms = spy(ok);
  const p = new NotificationProcessor({ email: email.fn, sms: sms.fn });
  p.sendOne(
    notif([
      { type: "email", value: "a@b.c" },
      { type: "sms", value: "+1555000111" },
    ])
  );
  assert.equal(email.calls.length, 1);
  assert.equal(sms.calls.length, 1, "the second channel must be delivered too");
});

test("all channels succeed -> sent, lastError cleared, attempts incremented", () => {
  const p = new NotificationProcessor({ email: ok, sms: ok });
  const n = notif([
    { type: "email", value: "a@b.c" },
    { type: "sms", value: "+1555000111" },
  ]);
  p.sendOne(n);
  assert.equal(n.status, SENT);
  assert.equal(n.lastError, null);
  assert.equal(n.attempts, 1);
});

test("a temporary failure with no permanent failure -> retry_pending", () => {
  const p = new NotificationProcessor({ email: ok, sms: temp });
  const n = notif([
    { type: "email", value: "a@b.c" },
    { type: "sms", value: "+1555000111" },
  ]);
  p.sendOne(n);
  assert.equal(n.status, RETRY_PENDING);
});

test("a permanent failure -> failed", () => {
  const p = new NotificationProcessor({ email: perm });
  const n = notif([{ type: "email", value: "a@b.c" }]);
  p.sendOne(n);
  assert.equal(n.status, FAILED);
});

test("permanent failure dominates a temporary one -> failed", () => {
  const p = new NotificationProcessor({ email: perm, sms: temp });
  const n = notif([
    { type: "email", value: "a@b.c" },
    { type: "sms", value: "+1555000111" },
  ]);
  p.sendOne(n);
  assert.equal(n.status, FAILED);
});

test("an invalid request counts as a permanent failure -> failed", () => {
  const p = new NotificationProcessor({ email: invalid });
  const n = notif([{ type: "email", value: "bad" }]);
  p.sendOne(n);
  assert.equal(n.status, FAILED);
});

test("an unknown channel type -> failed, even if another channel is ok", () => {
  const p = new NotificationProcessor({ email: ok });
  const n = notif([
    { type: "email", value: "a@b.c" },
    { type: "carrier-pigeon", value: "x" },
  ]);
  p.sendOne(n);
  assert.equal(n.status, FAILED);
});

test("no target channels -> failed", () => {
  const p = new NotificationProcessor({ email: ok });
  const n = notif([]);
  p.sendOne(n);
  assert.equal(n.status, FAILED);
});
