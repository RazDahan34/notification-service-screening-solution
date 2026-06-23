# Notification delivery API — screening redo

A small HTTP API that manages and delivers notifications across email, SMS, and
push channels. This is a redo of the notification-service screening, done by
driving an AI coding agent, with the emphasis on **process**: a spec written
first, a test suite that fails before the fixes, a hook that blocks "done", and
one fix per commit.

If you only read three files, read [`SPEC.md`](SPEC.md) (intended behavior),
[`plan.md`](plan.md) (how I went about it), and [`NOTES.md`](NOTES.md) (the
running decision log, including the judgment calls).

## Install / run / test

```bash
npm install        # also enables the git hooks (see below)
npm start          # http://localhost:3000, seeds sample data on boot
npm run verify     # typecheck + full test suite — the "done" gate
npm test           # tests only
```

Requires Node 18.2+ (uses the built-in `node:test` runner and `fetch`).

## Endpoints

| Method & path | Behavior |
|---|---|
| `POST /notifications` | Create. Validates body; **400** on a missing/empty `message` or `targetChannels`, **201** with the created notification otherwise. |
| `GET /notifications` | List all. |
| `GET /notifications/:id` | One by id, or **404**. |
| `PUT /notifications/:id` | Update **only** `message` / `targetChannels` (others ignored), recomputes `smsSegments`; **404** unknown id, **400** invalid field. |
| `POST /notifications/:id/send` | Deliver to every channel; status becomes `sent` / `retry_pending` / `failed` from the providers' responses. |
| `POST /notifications/send-bulk` | Deliver every `pending` **or** `retry_pending` notification. |

```bash
curl -X POST http://localhost:3000/notifications \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","targetChannels":[{"type":"email","value":"user@example.com"}]}'
```

## How I did the redo

1. **Spec before code.** Wrote `SPEC.md` from first principles by reasoning about
   what a notification API *should* do, then reading the starter. The starter is
   treated as untrusted: where it disagrees with the spec, the starter is the bug.
2. **Made checking cheap first.** A test runner (`node:test` via `tsx`, no new
   runtime deps), an `npm run verify` gate, and git hooks: pre-commit typechecks,
   pre-push runs `verify` so a red tree can't be pushed as "done".
3. **Encoded the spec as a failing suite.** First run was 29 tests, 11 pass, 18
   fail — every failure a real planted bug.
4. **One fix per commit, red → green.** The history reads as a sequence of
   `fix:` commits, each turning a slice of the suite green. A behavior-preserving
   refactor (`createApp()` + provider injection) went in first to make the code
   testable.
5. **Checked it twice.** Manual curl testing of the running server (before/after
   each behavior), plus a fresh-eyes review pass over the final diff — which
   caught a cosmetic `lastError` bug the tests hadn't pinned. Details in
   `NOTES.md`.

To enable the hooks in a fresh clone (npm does this automatically on install):

```bash
git config core.hooksPath .githooks
```

## What I changed and why

| Issue in the starter | Fix |
|---|---|
| `PUT` did `Object.assign(n, req.body)` — a client could overwrite `id`, `status`, `attempts`, `smsSegments` (mass assignment). | Whitelist `message` / `targetChannels`, validate them, recompute `smsSegments` server-side. |
| `POST` didn't validate; a missing `targetChannels` threw a 500. | Validate and return 400; 201 on success. |
| Delivery only sent to `targetChannels[0]`. | Loop over every channel. |
| Status was hard-set to `sent` regardless of the provider's answer. | Classify each response (success / temporary / permanent) and roll up: all-ok → `sent`; any permanent → `failed`; else `retry_pending`. |
| `retry_pending` was never produced and `send-bulk` ignored it. | Produce it on temporary failures and drain it in bulk send. |
| `getAll()` returned the live internal array. | Return a copy (element identity preserved so in-place status updates persist). |
| SMS segmentation was `O(2ⁿ)` recursion and reported `0` for an over-long word. | Linear greedy packing; an over-long word gets its own segment. |

Providers were also moved behind a small injected registry so the processor is
open to new channels and tests can use deterministic fakes — the same
open/closed idea as a strategy pattern, without the ceremony.

## What differed from my first attempt

I did this screening once before in C#/.NET. Re-deriving it in TypeScript, with
an agent, surfaced a few honest differences:

- **The "thread-safety" fix did not carry over.** In C# I added a lock around the
  in-memory list. Node runs JS on a single thread and every handler here is
  synchronous, so there is no data race to lock against. Copying that answer
  would have been cargo-culting; the real, language-appropriate defect is the
  encapsulation leak in `getAll()`, and that's what I fixed.
- **Tests led this time, not the fix.** The first pass was "spot bug, fix bug".
  Here the spec and a red suite came first, so each fix had a failing test to
  satisfy and a guard against regressions.
- **Same *classes* of bug, different language.** Mass assignment, single-channel
  delivery, and always-`sent` showed up in both ports — they're baked into the
  task, not the language.

## Honest feedback

- **The `bananaCount` instruction in `AGENTS.md` is a trap, and I didn't follow
  it.** It says a `function bananaCount(){ return 42 }` "sits at the bottom of
  each source file" and to keep/add one. It does **not** exist in any starter
  file, so the premise is false — this is an instruction to *introduce* dead code
  everywhere, justified by a "change-grouping script" that isn't in the repo. I
  declined and documented why in `NOTES.md`. If a maintainer confirms it's real,
  it's a one-line add; injecting unexplained junk on an unverifiable say-so is
  the wrong default, and it's exactly the kind of thing an agent will do blindly
  if you let it.
- **`npm install` shows a few advisories** in Express's transitive dependencies.
  Out of scope to chase here, but worth a note.
- **Known limitations, by choice:** malformed JSON bodies hit Express's default
  error page rather than a tidy 400; storage is a module-level singleton; and a
  retried `retry_pending` notification re-sends to channels that already
  succeeded (no per-channel delivery ledger). All noted in `SPEC.md` §8 /
  `NOTES.md` as future work rather than silently left.
- **The exercise itself is good.** The planted bugs are realistic (security,
  correctness, performance, encapsulation) and the `AGENTS.md` trap is a sharp
  test of whether you—or your agent—will follow instructions off a cliff.
