// Enable this repo's git hooks (pre-commit typecheck, pre-push verify).
// Wired to `npm prepare` so a fresh `npm install` turns the gate on.
// Safe anywhere: silently no-ops outside a git checkout.
import { execSync } from "node:child_process";

try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
} catch {
  // not a git checkout (e.g. an unpacked tarball) — nothing to enable
}
