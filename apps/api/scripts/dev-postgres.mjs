#!/usr/bin/env node
/**
 * Embedded PostgreSQL 17 manager for development (no Docker needed).
 *
 * Windows quirk handled here: postgres.exe refuses to run under a token that
 * carries the Administrators group. When the shell is elevated we therefore
 * launch it through Task Scheduler, which hands out a filtered token
 * (`schtasks /Run`). Non-Windows systems start directly.
 *
 *   start   → initialise if needed, start server, ensure DB exists, wait ready
 *   stop    → pg_ctl stop
 *   status  → report reachability
 */
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(apiDir, "..", "..");
const localData = path.join(repoDir, ".localdata");
const pgData = path.join(localData, "postgres");
const pgBin = (() => {
  try {
    const require = createRequire(import.meta.url);
    // Resolve the package's main entry, then walk up to its root (its
    // exports map does not expose ./package.json).
    const entry = require.resolve("@embedded-postgres/windows-x64");
    const candidate = path.join(path.dirname(entry), "..", "native", "bin");
    if (fs.existsSync(path.join(candidate, "pg_ctl.exe"))) return candidate;
    // Fallback: locate it in the pnpm store.
    const store = path.join(repoDir, "node_modules", ".pnpm");
    const dir = fs
      .readdirSync(store)
      .find((d) => d.startsWith("@embedded-postgres+windows-x64@"));
    if (!dir) return null;
    const fallback = path.join(
      store, dir, "node_modules", "@embedded-postgres", "windows-x64", "native", "bin",
    );
    return fs.existsSync(path.join(fallback, "pg_ctl.exe")) ? fallback : null;
  } catch {
    return null;
  }
})();

const PORT = Number(process.env.DEV_PG_PORT ?? 55432);
const USER = "societyos";
const PASSWORD = "societyos";
const DB = "societyos";
const TASK_NAME = "SocietyOsDevPg";

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.setTimeout(800);
    s.once("connect", () => { s.destroy(); resolve(true); });
    s.once("error", () => resolve(false));
    s.once("timeout", () => { s.destroy(); resolve(false); });
  });
}

async function waitForPort(ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await isPortOpen(PORT)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", shell: false, ...opts });
}

/** Registers postgres.exe itself as the task process via an XML definition
 *  (paths go in dedicated XML elements — immune to schtasks quoting bugs).
 *  Filtered non-admin token + no wrapper console that could kill it. */
function startViaScheduledTask() {
  fs.mkdirSync(pgData, { recursive: true });
  // Ensure port config (idempotent marker)
  const confFile = path.join(pgData, "postgresql.conf");
  let conf = fs.readFileSync(confFile, "utf8");
  if (!conf.includes("societyos-dev-port")) {
    conf += `\n# societyos-dev-port\nport = ${PORT}\nlisten_addresses = '127.0.0.1'\n`;
    fs.writeFileSync(confFile, conf);
  }
  const xmlFile = path.join(localData, "pg-task.xml");
  const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers />
  <Principals>
    <Principal id="Author"><LogonType>InteractiveToken</LogonType></Principal>
  </Principals>
  <Settings>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>C:\\Windows\\System32\\cmd.exe</Command>
      <Arguments>/c ""${esc(path.join(pgBin, "postgres.exe"))}" -D "${esc(pgData)}" &gt; "${esc(path.join(localData, "pg-task-out.log"))}" 2&gt;&amp;1"</Arguments>
    </Exec>
  </Actions>
</Task>`;
  // schtasks requires UTF-16 **with BOM** — plain utf16le without BOM makes
  // /Run fail with ERROR_INVALID_DATA.
  fs.writeFileSync(xmlFile, "\uFEFF" + xml, "utf16le");
  try {
    sh("schtasks", ["/End", "/TN", TASK_NAME]); // stop zombie instance if any
  } catch { /* not running */ }
  sh("schtasks", ["/Create", "/TN", TASK_NAME, "/XML", xmlFile, "/F"]);
  sh("schtasks", ["/Run", "/TN", TASK_NAME]);
}

async function main() {
  const command = process.argv[2] ?? "start";

  if (command === "status") {
    console.log((await isPortOpen(PORT)) ? `✓ reachable on :${PORT}` : "✗ not running");
    return;
  }

  if (command === "stop") {
    try {
      sh("schtasks", ["/End", "/TN", TASK_NAME]);
      console.log("✓ stopped (task ended)");
    } catch {
      console.log("• task not running");
    }
    return;
  }

  if (command !== "start") {
    console.error("usage: dev-postgres.mjs [start|stop|status]");
    process.exit(2);
  }

  if (await isPortOpen(PORT)) {
    console.log(`• dev postgres already reachable on :${PORT}`);
    return;
  }
  if (!pgBin) throw new Error("@embedded-postgres/windows-x64 not installed");

  // 1. Initialise cluster once.
  if (!fs.existsSync(path.join(pgData, "PG_VERSION"))) {
    fs.mkdirSync(pgData, { recursive: true });
    console.log("[dev-postgres] initialising data dir…");
    sh(path.join(pgBin, "initdb.exe"), [
      "-D", pgData, "-U", USER, "-A", "trust", "-E", "UTF8", "--no-instructions",
    ]);
  }

  // 2. Start server (scheduled-task filtered token on Windows).
  if (process.platform === "win32") {
    startViaScheduledTask();
  } else {
    const child = import("node:child_process").then(() => undefined);
    void child;
    sh(path.join(pgBin, "pg_ctl.exe"), ["-D", pgData, "-l", path.join(pgData, "pg.log"), "-w", "-t", "90", "-o", `-p ${PORT}`, "start"]);
  }

  const ok = await waitForPort(120_000);
  if (!ok) {
    console.error(`✗ dev postgres failed to start; see ${path.join(pgData, "pg.log")}`);
    process.exit(1);
  }

  // 3. Ensure application database exists (client op — no admin restriction).
  try {
    sh(path.join(pgBin, "createdb.exe"), ["-h", "127.0.0.1", "-p", String(PORT), "-U", USER, DB]);
    console.log(`[dev-postgres] created database ${DB}`);
  } catch {
    /* already exists */
  }
  console.log(`✓ dev postgres ready on 127.0.0.1:${PORT} (db=${DB})`);
}

main().catch((err) => {
  console.error("[dev-postgres] fatal:", err.message ?? err);
  process.exit(1);
});
