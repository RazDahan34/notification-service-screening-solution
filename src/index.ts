import { seed } from "./storage.js";
import { createApp } from "./app.js";

// Bootstrap: seed in-memory data, then bind the port.
seed();

const PORT = 3000;
createApp().listen(PORT);
