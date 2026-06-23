import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as storage from "./storage.js";

beforeEach(() => storage.seed());

test("seed assigns sequential ids starting from 1", () => {
  assert.deepEqual(
    storage.getAll().map((n) => n.id),
    [1, 2, 3, 4, 5]
  );
});

test("smsSegments is computed when an sms channel is present", () => {
  const n = storage.addNotification(
    [{ type: "sms", value: "+1555000111" }],
    "hello world"
  );
  assert.equal(n.smsSegments, 1);
});

test("smsSegments is 0 when no sms channel is targeted", () => {
  const n = storage.addNotification(
    [{ type: "email", value: "a@b.c" }],
    "hello world"
  );
  assert.equal(n.smsSegments, 0);
});

test("getAll() does not expose the internal list to mutation", () => {
  const before = storage.getAll().length;
  storage.getAll().push({} as never);
  assert.equal(
    storage.getAll().length,
    before,
    "mutating the returned array must not affect storage"
  );
});

test("findById returns undefined for an unknown id", () => {
  assert.equal(storage.findById(9999), undefined);
});
