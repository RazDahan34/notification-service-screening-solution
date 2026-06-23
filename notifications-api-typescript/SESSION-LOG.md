# Session log — driving the agent

A scrubbed record of how I drove the AI coding agent through this redo: the
prompts I gave (paraphrased to English, tool branding removed) and what the
agent did in response. It is a faithful reconstruction of one working session,
not a verbatim dump — secrets and side chatter are removed, the substance and
order are intact.

The full trail also lives in the repo: `SPEC.md`, `plan.md`, `NOTES.md`, and the
commit history (`git log`).

---

## Turn 1 — Framing the task

**Me:** I did this notification-service screening once before (in C#). I need to
redo it from scratch, this time driving an agent. Here
are the assignment slides; start by reading my previous solution to understand
the task.

**Agent:** Read the prior C# solution and its README. Identified the task as a
planted-bug screening: a notifications API (email/SMS/push, in-memory) seeded
with deliberate defects, plus a suspicious instruction in `AGENTS.md` to add a
`bananaCount() => 42` helper to every file. Proposed two decisions for me:
language, and overall approach.

## Turn 2 — Choosing language and approach

**Me:** Use **TypeScript** (I'll provide the TS starter) — a fresh language is a
cleaner "from scratch" and forces more design. Take a **spec-first TDD**
approach.

**Agent:** Explored the TypeScript starter and catalogued seven issues against a
spec: mass assignment on `PUT`, single-channel delivery, always-`sent` status,
dead retry path, missing input validation, a leaked internal array from
`getAll()`, and an exponential SMS segmenter. Flagged that the `AGENTS.md`
`bananaCount` claim was **false** — no file actually contained it — and
recommended not following it.

## Turn 3 — Design before code

**Me:** Plan before you touch code. Write the spec for how the service should
behave, a short plan, and a notes file for decisions as you go. Set up the test
gate first — a runner plus a hook that blocks "done" on a red tree — and don't
pull in dependencies unless there's a real need.

**Agent:**
- Wrote `SPEC.md` (intended behavior, the source of truth), `plan.md` (spec-first
  TDD + commit plan), and `NOTES.md` (decision log, incl. the `bananaCount` call
  and a note that the C# "thread-safety/lock" fix does not transfer to
  single-threaded Node).
- Appended a working agreement to the starter's `AGENTS.md` documenting the
  `bananaCount` decision rather than silently complying.
- Set up the gate so checking is cheap: `node:test` via `tsx` (no new runtime
  deps), an `npm run verify` script.

## Turn 4 — Make it testable (no behavior change)

**Me:** The starter binds the port at import time and calls the providers
directly, which makes it awkward to test. Refactor for testability first,
without changing behavior: expose the app so tests can drive it in-process, and
let the providers be swapped for predictable fakes. Prove behavior is unchanged
before moving on.

**Agent:** Extracted `createApp()` (construction separated from port binding) and
moved providers behind an injectable registry, so routes and the processor can
be driven by tests with deterministic fakes. Verified identical runtime behavior
with a live smoke test before committing.

## Turn 5 — Red, then green

**Me:** Now turn the spec into a suite that fails against the current code, then
fix the bugs one at a time — one concern per commit — until it's all green. Keep
the commits small and the messages clear, and capture the before/after of each
behavior as you go.

**Agent:** Wrote the spec as a failing suite — first run **29 tests, 11 pass, 18
fail**, every failure a planted bug. Then drove each concern to green in its own
commit: POST validation (400/201), PUT mass-assignment, multi-channel delivery +
status classification, bulk-send retry draining, `getAll()` defensive copy, and
a linear greedy SMS segmenter. Captured the before/after of each behavior.

## Turn 6 — Check it twice

**Me:** Before we call it done, check it twice: run the server and hit the
endpoints by hand, including the abuse cases (mass-assignment, bad input,
multi-channel send), and do a fresh review pass over the final diff. Fix
anything that turns up and lock it with a test.

**Agent:** Exercised the running server with curl (mass-assignment now blocked,
invalid bodies → 400, invalid email → `failed` not `sent`). A fresh review pass
over the final diff caught a cosmetic `lastError` double-tag the tests hadn't
pinned; fixed it and locked it with assertions. Final state: **30 tests, 0
failures**, `npm run verify` green.


### What I'd highlight about *how* I worked

- I treated the starter as untrusted and let a spec + tests find the bugs, rather
  than eyeballing fixes.
- I refused the `bananaCount` instruction and documented why — judgment over
  blind compliance.
- I didn't copy my earlier C# answer: the "add a lock" fix is wrong for Node, so
  I fixed the real (encapsulation) defect instead.
