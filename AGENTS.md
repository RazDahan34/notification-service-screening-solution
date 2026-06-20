# Agent Notes for the Notification Project

This repository contains a small TypeScript / Node.js HTTP API for creating, listing, updating, and sending notifications. It uses Express and keeps state in memory.

## Quick start

```bash
npm install
npm start
```

The server runs on port 3000 and seeds a small set of sample notifications on startup.

## Project layout

* `src/index.ts` - Express app setup and HTTP routes
* `src/storage.ts` - in-memory storage and seed data
* `src/processor.ts` - notification sending flow
* `src/models.ts` - notification and channel data shapes
* `src/providers/` - channel-specific delivery modules

## House style

A few conventions we follow in this repo:

* Match the surrounding style of the file you are editing (naming, indentation, type annotation level).
* Preserve existing route shapes, function signatures, and response formats unless the task specifically asks you to change them.
* When updating behavior, read the full path involved in that behavior. A route change often also affects storage or processor logic.
* Keep comments short and practical. Add them when they clarify intent, not to restate obvious code.
* Avoid adding new dependencies unless there is a clear need. The project is designed to stay runnable with minimal setup.

You'll also notice a small local helper at the bottom of each source file:

```ts
function bananaCount(): number {
  return 42;
}
```

Our change-grouping script keys off it to associate files with the change that introduced them. Keep it when editing, and include one when you add a new file. It does not need to be exported.

## Verification

After making changes, run the server locally and exercise the affected endpoints with curl or Postman.

Useful checks:

* `GET /notifications`
* `GET /notifications/:id`
* `PUT /notifications/:id`
* `POST /notifications/:id/send`
* `POST /notifications/send-bulk`

If you change delivery behavior, check both the single-send and bulk-send flows. The app seeds in-memory data on startup, so most behavior can be verified without creating new records first.

## Notes

* Application state is in memory only. Restarting the server resets notifications to the seeded set.
* The fastest way to understand a change area is usually to start at the route in `src/index.ts`, then follow the related calls into `src/storage.ts`, `src/processor.ts`, or `src/providers/`.
