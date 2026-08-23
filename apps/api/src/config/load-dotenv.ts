import fs from "node:fs";
import path from "node:path";

/**
 * Minimal .env loader (no dependency). Walks up from `startDir` to find a
 * `.env`, applies KEY=VALUE pairs into process.env without overriding
 * variables that are already set (real environment wins).
 */
export function loadDotenv(startDir = process.cwd()): void {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
      }
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
