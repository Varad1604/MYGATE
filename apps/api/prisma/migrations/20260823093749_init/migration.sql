-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('VACANT', 'OWNER_OCCUPIED', 'TENANT_OCCUPIED', 'UNDER_MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('GUEST', 'DELIVERY', 'CAB', 'SERVICE_PROVIDER', 'CONTRACTOR', 'DOMESTIC_HELP', 'UTILITY_VEHICLE', 'EVENT_GUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitorStatus" AS ENUM ('CREATED', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'CHECKED_OUT', 'EXPIRED', 'CANCELLED', 'DENIED', 'OVERRIDDEN');

-- CreateEnum
CREATE TYPE "DeliveryPreference" AS ENUM ('ALLOW_ENTRY', 'LEAVE_AT_GATE', 'REJECT');

-- CreateEnum
CREATE TYPE "DomesticHelpCategory" AS ENUM ('MAID', 'COOK', 'DRIVER', 'NANNY', 'CLEANER', 'ELECTRICIAN', 'PLUMBER', 'GARDENER', 'TRAINER', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChargeCalcMethod" AS ENUM ('FIXED', 'AREA_BASED', 'UNIT_TYPE_BASED', 'METERED', 'MANUAL');

-- CreateEnum
CREATE TYPE "BillFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'APPROVED', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'NETBANKING', 'WALLET', 'BANK_TRANSFER', 'CHEQUE', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentProviderName" AS ENUM ('MOCK', 'RAZORPAY', 'CASHFREE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "NoticeType" AS ENUM ('ANNOUNCEMENT', 'EMERGENCY', 'MAINTENANCE', 'EVENT', 'BILLING_REMINDER', 'SECURITY');

-- CreateEnum
CREATE TYPE "NoticeAudience" AS ENUM ('ALL', 'TOWER', 'FLOOR', 'UNIT', 'OWNERS', 'TENANTS', 'CUSTOM_GROUP');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TWO_WHEELER', 'FOUR_WHEELER', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ParkingSlotKind" AS ENUM ('RESIDENT', 'VISITOR', 'DISABLED', 'STAFF', 'TWO_WHEELER');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('HELD_AT_GATE', 'COLLECTED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'PENDING_ONBOARDING');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PASSWORD_RESET', 'EMAIL_VERIFY');

-- CreateEnum
CREATE TYPE "OccupancyKind" AS ENUM ('OWNER', 'TENANT', 'FAMILY');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PRIVATE', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "ApprovalMethodColumn" AS ENUM ('PRE_APPROVED_TOKEN', 'RESIDENT_APPROVAL', 'SECURITY_OVERRIDE');

-- CreateEnum
CREATE TYPE "BillRunStatus" AS ENUM ('DRAFT', 'GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "planId" UUID,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "pricePaise" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tower" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "addressNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" UUID NOT NULL,
    "towerId" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitType" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "areaSqft" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "towerId" UUID NOT NULL,
    "floorId" UUID NOT NULL,
    "unitTypeId" UUID,
    "label" TEXT NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'VACANT',
    "areaSqft" DECIMAL(10,2),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "isPlatformSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT DEFAULT 'en',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" UUID,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "communityId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMembership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipRole" (
    "membershipId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "MembershipRole_pkey" PRIMARY KEY ("membershipId","roleId")
);

-- CreateTable
CREATE TABLE "UnitOccupancy" (
    "id" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "OccupancyKind" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "agreementMeta" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOccupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" UUID NOT NULL,
    "ownerUser" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relation" TEXT,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRef" (
    "id" UUID NOT NULL,
    "communityId" UUID,
    "uploaderUserId" UUID,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Gate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorInvitation" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "invitedByUserId" UUID NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT,
    "visitorType" "VisitorType" NOT NULL,
    "expectedAt" TIMESTAMP(3),
    "vehicleNumber" TEXT,
    "photoFileId" UUID,
    "tokenHash" TEXT,
    "otpCodeHash" TEXT,
    "shortCode" TEXT,
    "expiresAt" TIMESTAMP(3),
    "approvalMethod" "ApprovalMethodColumn",
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "deliveryPreference" "DeliveryPreference",
    "notes" TEXT,
    "status" "VisitorStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "invitationId" UUID,
    "gateId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorPhoneMasked" TEXT,
    "visitorType" "VisitorType" NOT NULL,
    "photoFileId" UUID,
    "vehicleNumber" TEXT,
    "requestedByUserId" UUID,
    "approvedByUserId" UUID,
    "approvalMethod" "ApprovalMethodColumn",
    "approvalAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "checkedInByGuardId" UUID,
    "checkedOutByGuardId" UUID,
    "overriddenByUserId" UUID,
    "overrideReason" TEXT,
    "status" "VisitorStatus" NOT NULL DEFAULT 'CREATED',
    "remarks" TEXT,
    "clientEventId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "invitationId" UUID,
    "unitId" UUID NOT NULL,
    "recipientName" TEXT NOT NULL,
    "courierName" TEXT,
    "description" TEXT,
    "photoFileId" UUID,
    "pickupTokenHash" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" TIMESTAMP(3),
    "collectedByUserId" UUID,
    "status" "ParcelStatus" NOT NULL DEFAULT 'HELD_AT_GATE',

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomesticHelpProfile" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "createdById" UUID,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "category" "DomesticHelpCategory" NOT NULL,
    "photoFileId" UUID,
    "idMeta" JSONB NOT NULL DEFAULT '{}',
    "scheduleText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomesticHelpProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomesticHelpUnitAssignment" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "allowedDays" TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomesticHelpUnitAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "departmentLabel" TEXT,
    "defaultAssigneeUserId" UUID,
    "slaFirstResponseMins" INTEGER,
    "slaResolutionMins" INTEGER,
    "escalationChain" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "unitId" UUID,
    "locationText" TEXT,
    "raisedById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" UUID,
    "slaFirstResponseDueAt" TIMESTAMP(3),
    "slaResolutionDueAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "satisfactionRating" INTEGER,
    "ratingComment" TEXT,
    "clientEventId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "fileId" UUID NOT NULL,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketHistory" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus",
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeHead" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "calcMethod" "ChargeCalcMethod" NOT NULL DEFAULT 'FIXED',
    "defaultAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargeHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillRun" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "BillFrequency" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "lateFeeConfig" JSONB NOT NULL DEFAULT '{}',
    "status" "BillRunStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "unitId" UUID NOT NULL,
    "billRunId" UUID,
    "periodLabel" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "chargeHeadId" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "unitPricePaise" INTEGER NOT NULL DEFAULT 0,
    "amountPaise" INTEGER NOT NULL,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "taxPaise" INTEGER NOT NULL DEFAULT 0,
    "calcMethodSnapshot" "ChargeCalcMethod" NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "payerUserId" UUID,
    "provider" "PaymentProviderName" NOT NULL,
    "method" "PaymentMethod",
    "amountPaise" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "webhookEventId" TEXT,
    "failureReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "paymentId" UUID NOT NULL,
    "pdfFileId" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "locationText" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "openTimeMinutes" INTEGER NOT NULL DEFAULT 360,
    "closeTimeMinutes" INTEGER NOT NULL DEFAULT 1320,
    "availableDays" TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 30,
    "pricePaise" INTEGER NOT NULL DEFAULT 0,
    "depositPaise" INTEGER NOT NULL DEFAULT 0,
    "maxBookingsPerMonth" INTEGER NOT NULL DEFAULT 4,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "cancellationCutoffHours" INTEGER NOT NULL DEFAULT 24,
    "blackoutDates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "amenityId" UUID NOT NULL,
    "bookedByUserId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 0,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "amountPaise" INTEGER NOT NULL DEFAULT 0,
    "paymentId" UUID,
    "approvedById" UUID,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NoticeType" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "audience" "NoticeAudience" NOT NULL DEFAULT 'ALL',
    "audienceTarget" JSONB NOT NULL DEFAULT '{}',
    "attachmentFileId" UUID,
    "requireAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "NoticeStatus" NOT NULL DEFAULT 'PUBLISHED',
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeAcknowledgement" (
    "noticeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeAcknowledgement_pkey" PRIMARY KEY ("noticeId","userId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "communityId" UUID,
    "recipientUserId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "unitId" UUID,
    "number" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'FOUR_WHEELER',
    "make" TEXT,
    "model" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingArea" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ParkingArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSlot" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "areaId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ParkingSlotKind" NOT NULL DEFAULT 'RESIDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ParkingSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingAllocation" (
    "id" UUID NOT NULL,
    "slotId" UUID NOT NULL,
    "vehicleId" UUID,
    "unitId" UUID,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "allocatedByUserId" UUID,
    "note" TEXT,

    CONSTRAINT "ParkingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "communityId" UUID,
    "actorUserId" UUID,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueJob" (
    "id" UUID NOT NULL,
    "queue" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "Community_status_idx" ON "Community"("status");

-- CreateIndex
CREATE INDEX "Tower_communityId_idx" ON "Tower"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Tower_communityId_code_key" ON "Tower"("communityId", "code");

-- CreateIndex
CREATE INDEX "Floor_towerId_idx" ON "Floor"("towerId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_towerId_level_key" ON "Floor"("towerId", "level");

-- CreateIndex
CREATE INDEX "UnitType_communityId_idx" ON "UnitType"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitType_communityId_name_key" ON "UnitType"("communityId", "name");

-- CreateIndex
CREATE INDEX "Unit_communityId_status_idx" ON "Unit"("communityId", "status");

-- CreateIndex
CREATE INDEX "Unit_towerId_idx" ON "Unit"("towerId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_communityId_label_key" ON "Unit"("communityId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "OtpCode_target_purpose_createdAt_idx" ON "OtpCode"("target", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "Role_communityId_idx" ON "Role"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_communityId_key_key" ON "Role"("communityId", "key");

-- CreateIndex
CREATE INDEX "CommunityMembership_communityId_idx" ON "CommunityMembership"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMembership_userId_communityId_key" ON "CommunityMembership"("userId", "communityId");

-- CreateIndex
CREATE INDEX "UnitOccupancy_unitId_effectiveFrom_idx" ON "UnitOccupancy"("unitId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "UnitOccupancy_userId_idx" ON "UnitOccupancy"("userId");

-- CreateIndex
CREATE INDEX "EmergencyContact_ownerUser_idx" ON "EmergencyContact"("ownerUser");

-- CreateIndex
CREATE UNIQUE INDEX "FileRef_storageKey_key" ON "FileRef"("storageKey");

-- CreateIndex
CREATE INDEX "Gate_communityId_idx" ON "Gate"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "Gate_communityId_code_key" ON "Gate"("communityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorInvitation_tokenHash_key" ON "VisitorInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "VisitorInvitation_communityId_status_idx" ON "VisitorInvitation"("communityId", "status");

-- CreateIndex
CREATE INDEX "VisitorInvitation_unitId_createdAt_idx" ON "VisitorInvitation"("unitId", "createdAt");

-- CreateIndex
CREATE INDEX "Visit_communityId_status_createdAt_idx" ON "Visit"("communityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Visit_communityId_checkedInAt_idx" ON "Visit"("communityId", "checkedInAt");

-- CreateIndex
CREATE INDEX "Visit_gateId_idx" ON "Visit"("gateId");

-- CreateIndex
CREATE UNIQUE INDEX "Visit_clientEventId_key" ON "Visit"("clientEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_invitationId_key" ON "Parcel"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_pickupTokenHash_key" ON "Parcel"("pickupTokenHash");

-- CreateIndex
CREATE INDEX "Parcel_communityId_status_idx" ON "Parcel"("communityId", "status");

-- CreateIndex
CREATE INDEX "DomesticHelpProfile_communityId_category_isActive_idx" ON "DomesticHelpProfile"("communityId", "category", "isActive");

-- CreateIndex
CREATE INDEX "DomesticHelpUnitAssignment_unitId_idx" ON "DomesticHelpUnitAssignment"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticHelpUnitAssignment_profileId_unitId_key" ON "DomesticHelpUnitAssignment"("profileId", "unitId");

-- CreateIndex
CREATE INDEX "TicketCategory_communityId_idx" ON "TicketCategory"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCategory_communityId_parentId_name_key" ON "TicketCategory"("communityId", "parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_reference_key" ON "Ticket"("reference");

-- CreateIndex
CREATE INDEX "Ticket_communityId_status_createdAt_idx" ON "Ticket"("communityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_assignedToUserId_status_idx" ON "Ticket"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "Ticket_raisedById_idx" ON "Ticket"("raisedById");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketHistory_ticketId_createdAt_idx" ON "TicketHistory"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ChargeHead_communityId_idx" ON "ChargeHead"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeHead_communityId_name_key" ON "ChargeHead"("communityId", "name");

-- CreateIndex
CREATE INDEX "BillRun_communityId_status_idx" ON "BillRun"("communityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BillRun_communityId_periodLabel_name_key" ON "BillRun"("communityId", "periodLabel", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_reference_key" ON "Invoice"("reference");

-- CreateIndex
CREATE INDEX "Invoice_communityId_status_dueDate_idx" ON "Invoice"("communityId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_unitId_status_idx" ON "Invoice"("unitId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_webhookEventId_key" ON "Payment"("webhookEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_communityId_status_idx" ON "Payment"("communityId", "status");

-- CreateIndex
CREATE INDEX "Payment_unitId_idx" ON "Payment"("unitId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_reference_key" ON "Receipt"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_reference_key" ON "CreditNote"("reference");

-- CreateIndex
CREATE INDEX "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");

-- CreateIndex
CREATE INDEX "Amenity_communityId_isActive_idx" ON "Amenity"("communityId", "isActive");

-- CreateIndex
CREATE INDEX "Booking_amenityId_startAt_endAt_idx" ON "Booking"("amenityId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Booking_bookedByUserId_idx" ON "Booking"("bookedByUserId");

-- CreateIndex
CREATE INDEX "Notice_communityId_status_publishAt_idx" ON "Notice"("communityId", "status", "publishAt");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Vehicle_number_idx" ON "Vehicle"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_communityId_number_key" ON "Vehicle"("communityId", "number");

-- CreateIndex
CREATE INDEX "ParkingArea_communityId_idx" ON "ParkingArea"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingArea_communityId_name_key" ON "ParkingArea"("communityId", "name");

-- CreateIndex
CREATE INDEX "ParkingSlot_communityId_idx" ON "ParkingSlot"("communityId");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSlot_areaId_code_key" ON "ParkingSlot"("areaId", "code");

-- CreateIndex
CREATE INDEX "ParkingAllocation_slotId_effectiveFrom_idx" ON "ParkingAllocation"("slotId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ParkingAllocation_vehicleId_idx" ON "ParkingAllocation"("vehicleId");

-- CreateIndex
CREATE INDEX "AuditEvent_communityId_createdAt_idx" ON "AuditEvent"("communityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueJob_dedupeKey_key" ON "QueueJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "QueueJob_queue_status_runAt_idx" ON "QueueJob"("queue", "status", "runAt");

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tower" ADD CONSTRAINT "Tower_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_towerId_fkey" FOREIGN KEY ("towerId") REFERENCES "Tower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitType" ADD CONSTRAINT "UnitType_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_towerId_fkey" FOREIGN KEY ("towerId") REFERENCES "Tower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "UnitType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CommunityMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipRole" ADD CONSTRAINT "MembershipRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitOccupancy" ADD CONSTRAINT "UnitOccupancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_ownerUser_fkey" FOREIGN KEY ("ownerUser") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRef" ADD CONSTRAINT "FileRef_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gate" ADD CONSTRAINT "Gate_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorInvitation" ADD CONSTRAINT "VisitorInvitation_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorInvitation" ADD CONSTRAINT "VisitorInvitation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "VisitorInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_gateId_fkey" FOREIGN KEY ("gateId") REFERENCES "Gate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "VisitorInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticHelpProfile" ADD CONSTRAINT "DomesticHelpProfile_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticHelpUnitAssignment" ADD CONSTRAINT "DomesticHelpUnitAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomesticHelpProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketHistory" ADD CONSTRAINT "TicketHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeHead" ADD CONSTRAINT "ChargeHead_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRun" ADD CONSTRAINT "BillRun_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billRunId_fkey" FOREIGN KEY ("billRunId") REFERENCES "BillRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_chargeHeadId_fkey" FOREIGN KEY ("chargeHeadId") REFERENCES "ChargeHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES "Amenity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeAcknowledgement" ADD CONSTRAINT "NoticeAcknowledgement_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingArea" ADD CONSTRAINT "ParkingArea_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSlot" ADD CONSTRAINT "ParkingSlot_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSlot" ADD CONSTRAINT "ParkingSlot_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "ParkingArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ParkingSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingAllocation" ADD CONSTRAINT "ParkingAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
