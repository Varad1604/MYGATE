#!/usr/bin/env node
/**
 * One-command development bootstrap (Windows/macOS/Linux).
 *  1. Writes .env from .env.example if missing (with generated secrets)
 *  2. Starts embedded Postgres (no Docker / admin rights needed)
 *  3. Runs Prisma migrations
 *  4. Seeds demo data
 * Safe to re-run; each step is idempotent.
 */
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root, shell: process.platform === "win32", ...opts });
  if (r.status !== 0) {
    console.error(`✗ command failed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
};

// 1. .env
if (!existsSync(resolve(root, ".env"))) {
  let tpl = readFileSync(resolve(root, ".env.example"), "utf8");
  tpl = tpl.replace("change-me-access-secret-at-least-32-chars-long", randomBytes(48).toString("hex"));
  tpl = tpl.replace("change-me-refresh-secret-at-least-32-chars-long", randomBytes(48).toString("hex"));
  writeFileSync(resolve(root, ".env"), tpl);
  console.log("✓ wrote .env (fresh secrets generated)");
} else {
  console.log("• .env already exists");
}

// 2-4. delegate to api package scripts (embedded pg → migrate → seed)
run("pnpm", ["--filter", "@societyos/api", "db:up"]);
run("pnpm", ["--filter", "@societyos/api", "db:migrate"]);
run("pnpm", ["--filter", "@societyos/api", "db:seed"]);
console.log("\n✔ Development environment ready. Start the stack with `pnpm dev:api` etc.");
