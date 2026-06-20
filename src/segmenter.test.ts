import { test } from "node:test";
import assert from "node:assert/strict";
import { minSmsSegments, MAX_SEGMENT_CHARS } from "./segmenter.js";

test("empty or whitespace-only message costs 0 segments", () => {
  assert.equal(minSmsSegments(""), 0);
  assert.equal(minSmsSegments("   "), 0);
});

test("a short message is a single segment", () => {
  assert.equal(minSmsSegments("hello world"), 1);
});

test("a message exactly at the limit is one segment", () => {
  assert.equal(minSmsSegments("a".repeat(MAX_SEGMENT_CHARS)), 1);
});

test("two long words that cannot share a segment cost two", () => {
  // 150 + 1 space + 20 = 171 > 160
  const msg = "x".repeat(150) + " " + "y".repeat(20);
  assert.equal(minSmsSegments(msg), 2);
});

test("a single word longer than the limit gets its own segment, not 0", () => {
  // 0 would read as "no SMS cost", which is misleading for a non-empty body.
  assert.equal(minSmsSegments("a".repeat(200)), 1);
});

test("an over-long word is not merged away into a free segment", () => {
  assert.equal(minSmsSegments("hi " + "a".repeat(200)), 2);
});
