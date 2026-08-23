#!/usr/bin/env node
/** Runs a command with the repository-root .env loaded (for Prisma CLI etc.). */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const envFile = path.join(repoRoot, ".env");
if (fs.existsSync(envFile)) {
  for (const rawLine of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!(key in process.env)) process.env[key] = line.slice(eq + 1).trim();
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: run-with-env.mjs <command> [args…]");
  process.exit(2);
}
const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
