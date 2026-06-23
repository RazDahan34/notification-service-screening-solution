import { test, beforeEach, type TestContext } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { createApp } from "./app.js";
import { NotificationProcessor, type Provider } from "./processor.js";
import * as storage from "./storage.js";

// Starts an app on an ephemeral port and registers teardown on the test context
// so the server is always closed — even when an assertion fails mid-test.
function serve(t: TestContext, app: Express) {
  return new Promise<string>((resolve) => {
    const server = app.listen(0, () => {
      t.after(
        () =>
          new Promise<void>((done) => {
            server.close(() => done());
            server.closeAllConnections(); // fetch keep-alive would otherwise hang
          })
      );
      resolve(`http://localhost:${(server.address() as AddressInfo).port}`);
    });
  });
}

const post = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const put = (body: unknown) => ({
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const ok: Provider = () => ({ Result: "Success", ErrorCode: "", Message: "ok" });
const temp: Provider = () => ({
  Result: "TemporaryFailure",
  ErrorCode: "",
  Message: "temp",
});

beforeEach(() => storage.seed());

test("GET /notifications returns the seeded list", async (t) => {
  const url = await serve(t, createApp());
  const r = await fetch(`${url}/notifications`);
  assert.equal(r.status, 200);
  assert.equal(((await r.json()) as unknown[]).length, 5);
});

test("GET /notifications/:id returns 404 for an unknown id", async (t) => {
  const url = await serve(t, createApp());
  const r = await fetch(`${url}/notifications/9999`);
  assert.equal(r.status, 404);
});

test("POST /notifications creates with 201 and pending status", async (t) => {
  const url = await serve(t, createApp());
  const r = await fetch(
    `${url}/notifications`,
    post({ message: "hi", targetChannels: [{ type: "email", value: "a@b.c" }] })
  );
  assert.equal(r.status, 201);
  assert.equal((await r.json()).status, "pending");
});

test("POST /notifications rejects a missing targetChannels with 400", async (t) => {
  const url = await serve(t, createApp());
  const r = await fetch(`${url}/notifications`, post({ message: "hi" }));
  assert.equal(r.status, 400);
});

test("POST /notifications rejects an empty message with 400", async (t) => {
  const url = await serve(t, createApp());
  const r = await fetch(
    `${url}/notifications`,
    post({ message: "", targetChannels: [{ type: "email", value: "a@b.c" }] })
  );
  assert.equal(r.status, 400);
});

test("POST /notifications rejects an empty channel list with 400", async (t) => {
  const url = await serve(t, createApp());
  const r = await fetch(
    `${url}/notifications`,
    post({ message: "hi", targetChannels: [] })
  );
  assert.equal(r.status, 400);
});

test("PUT /notifications/:id ignores server-controlled fields (no mass assignment)", async (t) => {
  const url = await serve(t, createApp());
  const r = await fetch(
    `${url}/notifications/1`,
    put({
      message: "updated",
      id: 999,
      status: "hacked",
      attempts: -5,
      smsSegments: 4242,
    })
  );
  assert.equal(r.status, 200);
  const n = await r.json();
  assert.equal(n.id, 1, "id must not change");
  assert.equal(n.message, "updated", "allowed field should change");
  assert.notEqual(n.status, "hacked", "status is server-controlled");
  assert.notEqual(n.attempts, -5, "attempts is server-controlled");
  assert.notEqual(n.smsSegments, 4242, "smsSegments is server-controlled");
});

test("PUT /notifications/:id recomputes smsSegments on a message change", async (t) => {
  const url = await serve(t, createApp());
  // id 2 is an sms notification in the seed; this body needs two segments.
  const body = "x".repeat(150) + " " + "y".repeat(20);
  const r = await fetch(`${url}/notifications/2`, put({ message: body }));
  assert.equal((await r.json()).smsSegments, 2);
});

test("POST /:id/send reflects the provider outcome across all channels", async (t) => {
  const url = await serve(t, createApp(new NotificationProcessor({ email: ok, sms: temp })));
  const created = storage.addNotification(
    [
      { type: "email", value: "a@b.c" },
      { type: "sms", value: "+1555000111" },
    ],
    "hi"
  );
  const r = await fetch(`${url}/notifications/${created.id}/send`, {
    method: "POST",
  });
  assert.equal((await r.json()).status, "retry_pending");
});

test("POST /send-bulk also drains retry_pending notifications", async (t) => {
  const url = await serve(
    t,
    createApp(new NotificationProcessor({ email: ok, sms: ok, push: ok }))
  );
  assert.equal(storage.findById(5)!.status, "retry_pending"); // seed precondition
  await fetch(`${url}/notifications/send-bulk`, { method: "POST" });
  assert.equal(
    storage.findById(5)!.status,
    "sent",
    "retry_pending must be picked up by bulk send"
  );
});
