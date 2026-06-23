# Plan — redoing the notification-service screening with an agent

Goal of this exercise is **how**, not a perfect repo: a deliberate setup, a
test-first process, real verification, and an honest write-up. This plan was
written before any code changes.

## Approach: spec-first TDD

1. Write `SPEC.md` from first principles (done) — the behavior the tests assert.
2. Make checking cheap *before* coding:
   - a test runner (`node:test` + `tsx`, zero new runtime deps),
   - an `npm run verify` gate (typecheck + tests),
3. Encode the spec as a **failing** suite (red), so every planted bug shows up as
   a failing assertion rather than a vibe.
4. Fix one concern per commit, turning the suite green incrementally.
5. Check it twice: a fresh read-through review pass **and** manual testing of the
   running server (curl), both recorded.
6. Write `README.md` by hand: what I did, what differed, honest feedback.

## Why these tools

- **`node:test` + `tsx`** over Vitest/Jest: the repo's AGENTS.md asks to avoid new
  dependencies "unless there is a clear need." The built-in runner covers the
  need with no runtime deps and no config. A test runner is the one justified
  addition; documented in NOTES.
- **Dependency injection for providers**: the processor will take a provider
  registry (defaulting to the real ones) so tests are deterministic without
  monkey-patching `Math.random`. This also fixes the open/closed extensibility
  smell.
- **`createApp()` factory**: separate app construction from port binding so
  integration tests can drive routes in-process via `fetch` on an ephemeral
  port — again, no `supertest` dependency.

## Testability refactor (behavior-preserving, lands before fixes)

- `src/app.ts`: `createApp()` builds the Express app + routes; returns it.
- `src/index.ts`: bootstrap only — `seed()` then `createApp().listen(3000)`.
- `NotificationProcessor(providers = { email, sms, push })`: inject the registry.

These change *structure*, not behavior; the existing suite stays as-is across them.

## Commit plan

1. baseline import (pristine starter) — done.
2. docs: SPEC, plan, NOTES, working-agreement append to AGENTS.
3. build: test runner, `verify` gate, git hooks, gitattributes/ignore.
4. refactor: `createApp()` + provider DI (no behavior change).
5. test: failing spec suite (red); capture the red run in NOTES.
6. fix: validate `POST /notifications` (400 on bad body).
7. fix: secure `PUT` against mass assignment; recompute `smsSegments`.
8. fix: deliver to every target channel.
9. fix: derive status from provider responses (sent / retry_pending / failed).
10. fix: include `retry_pending` in bulk send.
11. fix: `getAll()` returns a copy (encapsulation).
12. perf: linear greedy SMS segmentation + over-long-word behavior.
13. docs: README; finalize NOTES + honest feedback.

## Verification plan

- `npm run verify` green at the end (typecheck + full suite).
- Manual run: start the server, exercise every endpoint with curl, including the
  abuse cases (mass-assignment attempt, invalid body, multi-channel send).
- Second-pass review with fresh eyes over the final diff; findings logged.

## Judgment calls flagged up front (detail in NOTES.md)

- **The `bananaCount` instruction in AGENTS.md** asks to add a dead
  `function bananaCount(){ return 42 }` to every file. The claim that it already
  exists "at the bottom of each source file" is **false** — no starter file
  contains it.
- **"Thread-safety"** from the C# framing does not transfer: Node's event loop is
  single-threaded for JS, so there is no data race to lock against. The genuine
  defect is returning the live array; that is what gets fixed.
