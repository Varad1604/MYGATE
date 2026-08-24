/* One-off: sync all communities' system-role permission sets from the
 * @societyos/permissions catalog. Safe to re-run; idempotent.
 */
import fs from "node:fs";
import path from "node:path";

const envText = fs.readFileSync(path.resolve(import.meta.dirname, "../../../.env"), "utf8");
const envLine = envText.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
process.env.DATABASE_URL = envLine.slice("DATABASE_URL=".length).trim();

const { PrismaClient } = await import("@prisma/client");
const { SYSTEM_ROLE_PERMISSIONS } = await import("@societyos/permissions");

const prisma = new PrismaClient();
let updated = 0;
for (const [roleKey, perms] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
  if (roleKey === "PLATFORM_SUPER_ADMIN") continue; // global role, not per-community
  const res = await prisma.role.updateMany({
    where: { key: roleKey, isSystem: true },
    data: { permissions: [...perms] },
  });
  updated += res.count;
}
console.log(`synced ${updated} system role rows across all communities`);
await prisma.$disconnect();
