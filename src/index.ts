import express from "express";
import { seed, addNotification, getAll, findById } from "./storage.js";
import { NotificationProcessor } from "./processor.js";

const app = express();
app.use(express.json());

seed();

const processor = new NotificationProcessor();

app.post("/notifications", (req, res) => {
  const n = addNotification(req.body.targetChannels, req.body.message);
  res.json(n);
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
  Object.assign(n, req.body);
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

const PORT = 3000;
app.listen(PORT);
