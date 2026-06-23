import express from "express";
import { addNotification, getAll, findById, smsSegmentsFor } from "./storage.js";
import { NotificationProcessor } from "./processor.js";
import { validateCreate, validateMessage, validateChannels } from "./validation.js";

// Builds the Express app and registers routes. Construction is separated from
// port binding (see index.ts) so tests can drive the routes in-process.
// The processor is injectable so integration tests can supply fake providers.
export function createApp(
  processor: NotificationProcessor = new NotificationProcessor()
) {
  const app = express();
  app.use(express.json());

  app.post("/notifications", (req, res) => {
    const parsed = validateCreate(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const n = addNotification(parsed.value.targetChannels, parsed.value.message);
    res.status(201).json(n);
  });

  app.get("/notifications", (_req, res) => {
    res.json(getAll());
  });

  app.get("/notifications/:id", (req, res) => {
    const n = findById(Number(req.params.id));
    if (!n) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(n);
  });

  app.put("/notifications/:id", (req, res) => {
    const n = findById(Number(req.params.id));
    if (!n) {
      res.status(404).json({ error: "not found" });
      return;
    }

    // Whitelist: only message and targetChannels may be changed by a client.
    // Everything else (id, status, attempts, timestamps, smsSegments) is
    // server-controlled and must never be set from the request body.
    const body = (req.body ?? {}) as Record<string, unknown>;

    if (body.message !== undefined) {
      const m = validateMessage(body.message);
      if (!m.ok) {
        res.status(400).json({ error: m.error });
        return;
      }
      n.message = m.value;
    }

    if (body.targetChannels !== undefined) {
      const c = validateChannels(body.targetChannels);
      if (!c.ok) {
        res.status(400).json({ error: c.error });
        return;
      }
      n.targetChannels = c.value;
    }

    // Recompute derived state from the (validated) fields, not the request.
    n.smsSegments = smsSegmentsFor(n.targetChannels, n.message);

    res.json(n);
  });

  app.post("/notifications/:id/send", (req, res) => {
    const n = findById(Number(req.params.id));
    if (!n) {
      res.status(404).json({ error: "not found" });
      return;
    }
    processor.sendOne(n);
    res.json(n);
  });

  app.post("/notifications/send-bulk", (_req, res) => {
    processor.sendAll();
    res.json(getAll());
  });

  return app;
}
