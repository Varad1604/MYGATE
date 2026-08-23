/** Dev debug: inspect users by phone fragment with memberships + occupancies. */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const frag = process.argv[2] ?? "9911100101";
const users = await prisma.user.findMany({
  where: { phone: { contains: frag } },
  select: {
    id: true, phone: true, status: true,
    memberships: { select: { id: true, communityId: true, isDefault: true, roles: { select: { role: { select: { key: true } } } } } },
    occupancies: { select: { unitId: true, kind: true, effectiveTo: true } },
  },
});
console.log(JSON.stringify(users, null, 2));
await prisma.$disconnect();
