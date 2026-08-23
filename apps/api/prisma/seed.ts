/**
 * Development/demo seed — clearly marked DEMO DATA.
 * Creates: platform super admin, Greenview Residency community with towers,
 * units, residents, gates, amenities, charge heads, ticket categories,
 * staff accounts and a demo pre-approved visitor invitation.
 * Re-runnable: removes previous demo community + stray onboarding users first.
 *
 * Printed credentials:
 *   Platform admin  platform@societyos.dev / Demo#Pass1
 *   Society admin   admin@greenview.test  / Demo#Pass1
 *   Resident owner  anita@example.com / phone OTP (+91991100101 normalized)
 *   Guard           phone +919900000011 (OTP via mock → API console)
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { randomBytes, createHash } from "node:crypto";
import { normalizePhone } from "@societyos/types";

const prisma = new PrismaClient();

const DEMO_TAG = "DEMO-DATA";
const argonOpts = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

async function main() {
  console.log(`[seed] Seeding development environment (${DEMO_TAG})…`);

  // Remove stray self-onboarded accounts from previous dev runs.
  await prisma.refreshToken.deleteMany({
    where: { user: { status: "PENDING_ONBOARDING", memberships: { none: {} } } },
  });
  await prisma.user.deleteMany({
    where: { status: "PENDING_ONBOARDING", memberships: { none: {} } },
  });

  // Recreate demo staff/resident accounts fresh (dev-only identities).
  const demoPhones = [
    "+919900000001", "+919911100101", "+919911100102", "+919911100201",
    "+919911100301", "+919900000010", "+919900000011", "+919900000020",
  ];
  await prisma.refreshToken.deleteMany({
    where: { user: { OR: [{ email: "admin@greenview.test" }, { phone: { in: demoPhones } }] } },
  });
  await prisma.user.deleteMany({
    where: { OR: [{ email: "admin@greenview.test" }, { phone: { in: demoPhones } }] },
  });

  const passwordHash = await hash("Demo#Pass1", argonOpts);

  // ── Platform admin ────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "platform@societyos.dev" },
    update: { passwordHash },
    create: {
      fullName: "Platform Super Admin",
      email: "platform@societyos.dev",
      passwordHash,
      isPlatformSuperAdmin: true,
      status: "ACTIVE",
    },
  });

  // ── Community (fresh copy each run) ──────────────────────────────────────
  const existing = await prisma.community.findUnique({ where: { slug: "greenview-residency" } });
  if (existing) {
    // Delete previous demo data in FK-safe order.
    await prisma.$transaction([
      prisma.ticketHistory.deleteMany({ where: { ticket: { communityId: existing.id } } }),
      prisma.ticketAttachment.deleteMany({ where: { ticket: { communityId: existing.id } } }),
      prisma.ticketComment.deleteMany({ where: { ticket: { communityId: existing.id } } }),
      prisma.ticket.deleteMany({ where: { communityId: existing.id } }),
      prisma.ticketCategory.deleteMany({ where: { communityId: existing.id } }),
      prisma.creditNote.deleteMany({ where: { communityId: existing.id } }),
      prisma.paymentAllocation.deleteMany({ where: { payment: { communityId: existing.id } } }),
      prisma.receipt.deleteMany({ where: { communityId: existing.id } }),
      prisma.payment.deleteMany({ where: { communityId: existing.id } }),
      prisma.invoiceLine.deleteMany({ where: { invoice: { communityId: existing.id } } }),
      prisma.invoice.updateMany({ where: { communityId: existing.id }, data: { billRunId: null } }),
      prisma.invoice.deleteMany({ where: { communityId: existing.id } }),
      prisma.billRun.deleteMany({ where: { communityId: existing.id } }),
      prisma.chargeHead.deleteMany({ where: { communityId: existing.id } }),
      prisma.booking.deleteMany({ where: { communityId: existing.id } }),
      prisma.amenity.deleteMany({ where: { communityId: existing.id } }),
      prisma.parkingAllocation.deleteMany({ where: { slot: { communityId: existing.id } } }),
      prisma.vehicle.deleteMany({ where: { communityId: existing.id } }),
      prisma.parkingSlot.deleteMany({ where: { communityId: existing.id } }),
      prisma.parkingArea.deleteMany({ where: { communityId: existing.id } }),
      prisma.noticeAcknowledgement.deleteMany({ where: { notice: { communityId: existing.id } } }),
      prisma.notice.deleteMany({ where: { communityId: existing.id } }),
      prisma.notification.deleteMany({ where: { communityId: existing.id } }),
      prisma.parcel.deleteMany({ where: { communityId: existing.id } }),
      prisma.visit.deleteMany({ where: { communityId: existing.id } }),
      prisma.visitorInvitation.deleteMany({ where: { communityId: existing.id } }),
      prisma.domesticHelpUnitAssignment.deleteMany({ where: { profile: { communityId: existing.id } } }),
      prisma.domesticHelpProfile.deleteMany({ where: { communityId: existing.id } }),
      prisma.auditEvent.deleteMany({ where: { communityId: existing.id } }),
      prisma.membershipRole.deleteMany({ where: { membership: { communityId: existing.id } } }),
      prisma.communityMembership.deleteMany({ where: { communityId: existing.id } }),
      prisma.role.deleteMany({ where: { communityId: existing.id } }),
      prisma.unitOccupancy.deleteMany({ where: { unit: { communityId: existing.id } } }),
      prisma.unit.deleteMany({ where: { communityId: existing.id } }),
      prisma.floor.deleteMany({ where: { tower: { communityId: existing.id } } }),
      prisma.tower.deleteMany({ where: { communityId: existing.id } }),
      prisma.unitType.deleteMany({ where: { communityId: existing.id } }),
      prisma.gate.deleteMany({ where: { communityId: existing.id } }),
      prisma.community.delete({ where: { id: existing.id } }),
    ]);
  }

  const community = await prisma.community.create({
    data: {
      name: "Greenview Residency",
      slug: "greenview-residency",
      address: "Greenview Residency, Hennur Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560077",
      timezone: "Asia/Kolkata",
      status: "ACTIVE",
      settings: { visitorApprovalTimeoutSeconds: 90, billingCycleDay: 5 },
    },
  });

  // System roles for the community
  const { SYSTEM_ROLE_PERMISSIONS } = await import("@societyos/permissions");
  const roleKeys = Object.keys(SYSTEM_ROLE_PERMISSIONS).filter((k) => k !== "PLATFORM_SUPER_ADMIN");
  const roleMap = new Map<string, string>();
  for (const key of roleKeys) {
    const role = await prisma.role.create({
      data: {
        communityId: community.id,
        key,
        name: key.replaceAll("_", " "),
        isSystem: true,
        permissions: [...SYSTEM_ROLE_PERMISSIONS[key as keyof typeof SYSTEM_ROLE_PERMISSIONS]],
      },
    });
    roleMap.set(key, role.id);
  }

  // ── Society admin ─────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      fullName: "Rajesh Kumar (Society Admin)",
      email: "admin@greenview.test",
      phone: normalizePhone("+919900000001"),
      passwordHash,
      status: "ACTIVE",
      memberships: {
        create: {
          communityId: community.id,
          isDefault: true,
          roles: { create: [{ roleId: roleMap.get("COMMUNITY_ADMIN")! }] },
        },
      },
    },
  });

  // ── Towers / floors / units ───────────────────────────────────────────────
  const unitType = await prisma.unitType.create({
    data: { communityId: community.id, name: "3BHK", bedrooms: 3, areaSqft: 1450 },
  });
  for (const code of ["A", "B", "C"]) {
    const tower = await prisma.tower.create({
      data: { communityId: community.id, name: `Tower ${code}`, code },
    });
    for (let level = 1; level <= 3; level++) {
      const floor = await prisma.floor.create({
        data: { towerId: tower.id, level, label: String(level) },
      });
      for (const n of ["01", "02", "03", "04"]) {
        await prisma.unit.create({
          data: {
            communityId: community.id,
            towerId: tower.id,
            floorId: floor.id,
            unitTypeId: unitType.id,
            label: `${code}-${level}${n}`,
            areaSqft: 1450,
          },
        });
      }
    }
  }

  // ── Gates / amenities / charge heads / ticket categories ─────────────────
  await prisma.gate.createMany({
    data: [
      { communityId: community.id, name: "Main Gate", code: "MAIN" },
      { communityId: community.id, name: "Service Gate", code: "SVC" },
    ],
  });

  await prisma.amenity.createMany({
    data: [
      {
        communityId: community.id, name: "Clubhouse", locationText: "Block B basement",
        capacity: 80, slotMinutes: 120, pricePaise: 200000, depositPaise: 500000,
        openTimeMinutes: 540, closeTimeMinutes: 1320, bookingWindowDays: 30,
      },
      {
        communityId: community.id, name: "Gym", capacity: 12, slotMinutes: 60,
        pricePaise: 0, openTimeMinutes: 300, closeTimeMinutes: 1320, availableDays: "1,2,3,4,5,6",
      },
      {
        communityId: community.id, name: "Badminton Court", capacity: 4, slotMinutes: 60,
        pricePaise: 15000, openTimeMinutes: 360, closeTimeMinutes: 1260,
      },
    ],
  });

  await prisma.chargeHead.createMany({
    data: [
      { communityId: community.id, name: "Maintenance Dues", calcMethod: "AREA_BASED", defaultAmountPaise: 250 },
      { communityId: community.id, name: "Water Charges", calcMethod: "FIXED", defaultAmountPaise: 80000 },
      { communityId: community.id, name: "Parking Charges", calcMethod: "FIXED", defaultAmountPaise: 100000 },
      { communityId: community.id, name: "Sinking Fund", calcMethod: "AREA_BASED", defaultAmountPaise: 50 },
    ],
  });

  await prisma.ticketCategory.createMany({
    data: [
      {
        communityId: community.id, name: "Plumbing", departmentLabel: "Maintenance",
        slaFirstResponseMins: 60, slaResolutionMins: 1440,
        escalationChain: [
          { afterMins: 60, escalateToRoleKey: "HELPDESK_MANAGER" },
          { afterMins: 240, escalateToRoleKey: "FACILITY_MANAGER" },
        ],
      },
      { communityId: community.id, name: "Electrical", departmentLabel: "Maintenance", slaResolutionMins: 2880 },
      { communityId: community.id, name: "Housekeeping", departmentLabel: "Housekeeping", slaResolutionMins: 720 },
    ],
  });

  // ── Residents ─────────────────────────────────────────────────────────────
  async function addResident(opts: {
    unitLabel: string;
    kind: "OWNER" | "TENANT" | "FAMILY";
    fullName: string;
    phone: string;
    email?: string;
    primary?: boolean;
  }) {
    const unit = await prisma.unit.findFirstOrThrow({
      where: { communityId: community.id, label: opts.unitLabel },
    });
    const roleKey =
      opts.kind === "OWNER" ? "RESIDENT_OWNER" : opts.kind === "TENANT" ? "RESIDENT_TENANT" : "FAMILY_MEMBER";
    const roleId = roleMap.get(roleKey);
    if (!roleId) throw new Error(`role ${roleKey} missing`);

    const user = await prisma.user.create({
      data: {
        fullName: opts.fullName,
        phone: normalizePhone(opts.phone),
        email: opts.email ?? null,
        status: "ACTIVE",
        memberships: {
          create: {
            communityId: community.id,
            isDefault: true,
            roles: { create: [{ roleId }] },
          },
        },
      },
    });
    await prisma.unitOccupancy.create({
      data: {
        unitId: unit.id, userId: user.id, kind: opts.kind,
        isPrimaryContact: Boolean(opts.primary),
      },
    });
    await prisma.unit.update({
      where: { id: unit.id },
      data: { status: opts.kind === "TENANT" ? "TENANT_OCCUPIED" : "OWNER_OCCUPIED" },
    });
    return user;
  }

  const anita = await addResident({
    unitLabel: "A-101", kind: "OWNER", fullName: "Anita Sharma",
    phone: "+919911100101", email: "anita@example.com", primary: true,
  });
  await addResident({ unitLabel: "A-101", kind: "FAMILY", fullName: "Vikram Sharma", phone: "+919911100102" });
  await addResident({
    unitLabel: "A-201", kind: "TENANT", fullName: "Priya Nair",
    phone: "+919911100201", email: "priya@example.com", primary: true,
  });
  await addResident({ unitLabel: "B-102", kind: "OWNER", fullName: "Suresh Iyer", phone: "+919911100301", primary: true });

  // ── Security manager + guard + technician ─────────────────────────────────
  for (const [name, phone, roleKey] of [
    ["Deepak Singh (Security Manager)", "+919900000010", "SECURITY_MANAGER"],
    ["Ramesh (Guard · Main Gate)", "+919900000011", "GUARD"],
    ["Manoj (Plumber)", "+919900000020", "STAFF"],
  ] as const) {
    await prisma.user.create({
      data: {
        fullName: name,
        phone: normalizePhone(phone),
        memberships: {
          create: {
            communityId: community.id,
            roles: { create: [{ roleId: roleMap.get(roleKey)! }] },
          },
        },
      },
    });
  }

  // ── Demo pre-approved visitor invitation for Anita ────────────────────────
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const anitaUnit = await prisma.unit.findFirstOrThrow({
    where: { communityId: community.id, label: "A-101" },
  });
  await prisma.visitorInvitation.create({
    data: {
      communityId: community.id,
      unitId: anitaUnit.id,
      invitedByUserId: anita.id,
      visitorName: "Amit Verma",
      visitorPhone: normalizePhone("+919876543210"),
      visitorType: "GUEST",
      expectedAt: new Date(Date.now() + 3600_000),
      tokenHash,
      expiresAt: new Date(Date.now() + 6 * 3600_000),
      status: "APPROVED",
      approvalMethod: "PRE_APPROVED_TOKEN",
      approvedAt: new Date(),
      approvedByUserId: anita.id,
    },
  });
  console.log("[seed] demo invitation QR token:", token);

  console.log("\n========== DEMO LOGINS (development only) ==========");
  console.log("Platform admin : platform@societyos.dev / Demo#Pass1");
  console.log("Society admin  : admin@greenview.test  / Demo#Pass1");
  console.log("Resident owner : anita@example.com or phone +91 99111 00101 (OTP mock)");
  console.log("Guard          : phone +91 99000 00011 (OTP mock → API console)");
  console.log("====================================================\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
