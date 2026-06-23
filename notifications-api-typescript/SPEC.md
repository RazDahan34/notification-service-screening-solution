# SPEC — Notification delivery API

This document is the **source of truth** for how the service *should* behave. It was
written before touching the code, by reasoning about the domain from first
principles and reading the starter. The test suite encodes this spec; where the
starter disagrees with the spec, the starter is treated as the bug.

Scope is deliberately small: an in-memory HTTP API that creates, reads, updates,
and delivers notifications across `email`, `sms`, and `push` channels. No
persistence, auth, real network calls, or scheduling — those are explicit
non-goals (see end).

---

## 1. Domain model

A **Notification** is:

| field           | type                      | notes |
|-----------------|---------------------------|-------|
| `id`            | number                    | server-assigned, monotonic from 1, immutable |
| `targetChannels`| `{ type, value }[]`       | one or more delivery targets |
| `message`       | string                    | the body to deliver |
| `status`        | enum (below)              | server-controlled lifecycle state |
| `createdAt`     | ISO timestamp             | set on creation, immutable |
| `attempts`      | number                    | incremented once per delivery attempt of the whole notification |
| `lastAttemptAt` | ISO timestamp \| null     | time of the most recent attempt |
| `lastError`     | string \| null            | human-readable outcome of the last attempt; `null` when never attempted or last attempt fully succeeded |
| `smsSegments`   | number                    | billable SMS parts; `0` when no `sms` channel is targeted |

A **Channel** is `{ type: string, value: string }`. Known `type` values:
`email`, `sms`, `push`. Unknown types are *accepted on create* but *fail at send*
(keeps create decoupled from the provider registry — see §5).

**Status** is one of:

- `pending` — created, not yet (successfully) delivered.
- `processing` — transient, set while an attempt is in flight.
- `sent` — every targeted channel was delivered successfully.
- `retry_pending` — at least one channel hit a *temporary* failure and no channel hit a *permanent* one; eligible for a future retry.
- `failed` — at least one channel hit a *permanent* failure (or an unknown channel type).

Server-controlled fields (`id`, `status`, `createdAt`, `attempts`,
`lastAttemptAt`, `lastError`, `smsSegments`) are **never** writable by a client.

---

## 2. `POST /notifications` — create

Request body: `{ message: string, targetChannels: Channel[] }`.

Validation (all violations → **400** with `{ error }`, nothing stored):

- `message` must be a non-empty string.
- `targetChannels` must be a non-empty array.
- every channel must be an object with non-empty string `type` and `value`.

On success → **201** with the created notification. `status = pending`,
`attempts = 0`, `smsSegments` computed per §6.

> Starter bug: no validation. A missing `targetChannels` throws inside storage
> and surfaces as a 500.

---

## 3. `GET /notifications` and `GET /notifications/:id`

- `GET /notifications` → **200**, array of all notifications.
- `GET /notifications/:id` → **200** with the notification, or **404**
  `{ error: "not found" }` when no such id.

Reading must not expose internal storage to mutation (see §7).

---

## 4. `PUT /notifications/:id` — update

Request body may contain **only** `message` and/or `targetChannels`. Any other
field in the body is ignored (not an error). → **404** if id is unknown.

- If `message` provided: must be a non-empty string, else **400**.
- If `targetChannels` provided: must be a non-empty, well-formed array, else **400**.
- After applying allowed changes, `smsSegments` is recomputed per §6.
- Server-controlled fields are never altered by the request body.

On success → **200** with the updated notification.

> Starter bug: `Object.assign(n, req.body)` blindly copies every field from the
> request — a client could overwrite `id`, `status`, `attempts`, `smsSegments`,
> etc. This is a mass-assignment / over-posting vulnerability.

---

## 5. Delivery — `POST /notifications/:id/send`

→ **404** if id unknown. Otherwise attempt delivery and return **200** with the
updated notification.

Algorithm:

1. Set `status = processing`, `attempts += 1`, `lastAttemptAt = now`.
2. For **every** channel in `targetChannels` (not just the first), resolve a
   provider by `type` and call it. An unknown type is a per-channel
   *permanent* failure.
3. Classify each channel's `ProviderResponse` by its `Result`:
   - `Success` → ok
   - `TemporaryFailure` → temporary
   - `InvalidRequest` / `PermanentFailure` → permanent
4. Aggregate to the notification `status`:
   - all channels ok → `sent`, `lastError = null`
   - else if any channel permanent → `failed`
   - else (≥1 temporary, none permanent) → `retry_pending`
   - `lastError` holds a joined, human-readable summary of the non-ok channels.

**Policy note (intentional):** a permanent failure *dominates* a temporary one,
so a notification with one permanently-bounced channel is `failed` rather than
endlessly retried. This is a deliberate choice over the "any temporary ⇒ retry"
alternative; the trade-off and its limitation (no per-channel delivery ledger,
so a retry re-sends already-delivered channels) are recorded in NOTES.md.

> Starter bugs: only `targetChannels[0]` is delivered; status is hard-set to
> `sent` regardless of the provider response; `retry_pending` is never produced.

## 5b. Bulk delivery — `POST /notifications/send-bulk`

Delivers every notification whose status is `pending` **or** `retry_pending`,
using the same per-notification algorithm. → **200**, full list after the run.

> Starter bug: only `pending` is selected, so retries never drain.

---

## 6. SMS segmentation (`smsSegments`)

`smsSegments` is the **minimum number of 160-char (GSM-7) segments** needed to
carry `message`, packing whole words separated by single spaces, **without
splitting a word across segments**. Computed when a notification targets at
least one `sms` channel; otherwise `0`.

Contract:

- empty / whitespace-only message → `0`.
- words are tokens split on runs of whitespace.
- a segment holds words joined by single spaces, up to 160 chars.
- a word longer than 160 chars cannot share a segment; it **occupies its own
  segment** (counted as 1). It is never reported as `0` — `0` means "no SMS
  cost", which would be misleading for a non-empty message.
- greedy first-fit packing is optimal for this in-order partition, so the
  implementation is O(n) — not the starter's exponential recursion.

> Starter bugs: O(2ⁿ) recursive search; returns `0` for a single over-long word
> (reads as "free"), which contradicts the billing intent.

---

## 7. Storage invariants

- Ids are unique and assigned by the store.
- `getAll()` must return a collection the caller can iterate and serialize
  **without** being able to mutate the store's internal list (no leaking the
  live array reference). Element identity may be preserved so the processor can
  update a notification in place — only the *list* is defended.

> Starter bug: `getAll()` returns the live internal array; a caller could
> `push`/`splice` it and corrupt storage. (Note: Node is single-threaded, so the
> classic multi-thread data race does **not** apply here — the real defect is
> encapsulation, not locking. See NOTES.md.)

---

## 8. Non-goals (out of scope)

- Durable persistence (state is in-memory and resets on restart).
- Authentication / authorization.
- Real provider network calls (providers are simulated and random).
- Background scheduling / automatic retry timers (retry eligibility is modeled;
  draining is triggered by `send-bulk`).
- Per-channel delivery ledger / idempotent re-send (documented limitation).
