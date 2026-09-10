-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('DRAFT', 'READY', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'LEFT', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "SavingsStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CashLoanStatus" AS ENUM ('PENDING', 'VERIFIED', 'ACTIVE', 'PAID', 'OVERDUE', 'FINE_APPLIED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ItemLoanStatus" AS ENUM ('SELECTED', 'PENDING', 'CLEARED', 'OUTSTANDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('REGISTRATION_FEE', 'SAVINGS', 'CASH_LOAN', 'CASH_LOAN_PAYMENT', 'LOAN_FINE', 'ITEM_LOAN', 'ITEM_LOAN_PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityEventStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('PROFILE_PHOTO', 'AGREEMENT', 'REPORT', 'EXPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ISSUED', 'SIGNED', 'SUPERSEDED', 'VOID');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('MEMBER_GROUP_ADMIN', 'STAFF_DIRECT', 'GROUP_ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SECURITY', 'LOAN_DUE', 'LOAN_OVERDUE', 'FINE', 'SAVINGS_REMINDER', 'GROUP_ANNOUNCEMENT', 'CHAT', 'SYSTEM');

-- CreateTable
CREATE TABLE "SystemConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "systemName" VARCHAR(120) NOT NULL,
    "registrationFeeKes" BIGINT NOT NULL DEFAULT 200,
    "maxActiveMembersPerGroup" INTEGER NOT NULL DEFAULT 30,
    "cashLoanSavingsPercent" INTEGER NOT NULL DEFAULT 50,
    "cashLoanRepaymentDays" INTEGER NOT NULL DEFAULT 14,
    "cashLoanFinePercent" INTEGER NOT NULL DEFAULT 1,
    "requireMfaForPrivileged" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "emailNormalized" VARCHAR(254),
    "passwordHash" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "loginFailedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "description" VARCHAR(255) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" UUID,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MFAFactor" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "encryptedSecret" TEXT,
    "publicCredential" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MFAFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "csrfTokenHash" VARCHAR(64) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaCompletedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" VARCHAR(64),
    "userAgentHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" VARCHAR(120),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "identifierHash" VARCHAR(64) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" VARCHAR(80),
    "ipHash" VARCHAR(64),
    "userAgentHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'DRAFT',
    "savingsPolicyJson" JSONB NOT NULL,
    "constitutionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "suspendedAt" TIMESTAMP(3),

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAdminAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupAdminAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fullName" VARCHAR(160) NOT NULL,
    "phoneE164" VARCHAR(20),
    "memberNumber" VARCHAR(50) NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profilePhotoFileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberProfileId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdById" UUID,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationFee" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberProfileId" UUID NOT NULL,
    "amountKes" BIGINT NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsAccount" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberProfileId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsTransaction" (
    "id" UUID NOT NULL,
    "savingsAccountId" UUID NOT NULL,
    "contributionWeek" DATE NOT NULL,
    "amountKes" BIGINT NOT NULL,
    "status" "SavingsStatus" NOT NULL DEFAULT 'POSTED',
    "reference" VARCHAR(100) NOT NULL,
    "reversalOfId" UUID,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashLoan" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberProfileId" UUID NOT NULL,
    "principalKes" BIGINT NOT NULL,
    "outstandingKes" BIGINT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "status" "CashLoanStatus" NOT NULL DEFAULT 'PENDING',
    "verificationStatus" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashLoanPayment" (
    "id" UUID NOT NULL,
    "cashLoanId" UUID NOT NULL,
    "amountKes" BIGINT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" VARCHAR(100) NOT NULL,
    "verifiedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashLoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanFine" (
    "id" UUID NOT NULL,
    "cashLoanId" UUID NOT NULL,
    "amountKes" BIGINT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "LoanFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "priceKes" BIGINT NOT NULL,
    "availableFrom" DATE NOT NULL,
    "availableUntil" DATE NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLoan" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "memberProfileId" UUID NOT NULL,
    "priceKes" BIGINT NOT NULL,
    "outstandingKes" BIGINT NOT NULL,
    "status" "ItemLoanStatus" NOT NULL DEFAULT 'SELECTED',
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    "verifierId" UUID,

    CONSTRAINT "ItemLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemLoanPayment" (
    "id" UUID NOT NULL,
    "itemLoanId" UUID NOT NULL,
    "amountKes" BIGINT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" VARCHAR(100) NOT NULL,
    "verifiedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemLoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberProfileId" UUID,
    "category" "LedgerCategory" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountKes" BIGINT NOT NULL,
    "referenceType" VARCHAR(50) NOT NULL,
    "referenceId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(100) NOT NULL,
    "reversalOfId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "contentType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAgreement" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "memberProfileId" UUID NOT NULL,
    "fileAssetId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" VARCHAR(64) NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "supersedesId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementSignature" (
    "id" UUID NOT NULL,
    "memberAgreementId" UUID NOT NULL,
    "signerUserId" UUID NOT NULL,
    "signerRoleSnapshot" VARCHAR(40) NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureMethod" VARCHAR(80) NOT NULL,
    "signatureEvidenceHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "AgreementSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" UUID NOT NULL,
    "groupId" UUID,
    "type" "ConversationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatParticipant" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderUserId" UUID NOT NULL,
    "clientMessageId" UUID NOT NULL,
    "bodyCiphertext" TEXT NOT NULL,
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL,
    "subjectUserId" UUID,
    "type" VARCHAR(100) NOT NULL,
    "severity" "SecuritySeverity" NOT NULL,
    "status" "SecurityEventStatus" NOT NULL DEFAULT 'OPEN',
    "ipHash" VARCHAR(64),
    "metadata" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "actorRoleSnapshot" VARCHAR(100),
    "action" VARCHAR(120) NOT NULL,
    "targetType" VARCHAR(80) NOT NULL,
    "targetId" UUID,
    "outcome" VARCHAR(20) NOT NULL,
    "requestId" UUID,
    "sourceIpHash" VARCHAR(64),
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "reason" VARCHAR(255),
    "previousHash" VARCHAR(64),
    "entryHash" VARCHAR(64) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "groupId" UUID,
    "type" VARCHAR(60) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "filters" JSONB,
    "status" "ReportStatus" NOT NULL DEFAULT 'REQUESTED',
    "fileAssetId" UUID,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_userId_status_idx" ON "Invitation"("userId", "status");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "MFAFactor_userId_verifiedAt_idx" ON "MFAFactor"("userId", "verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_status_expiresAt_idx" ON "Session"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_identifierHash_createdAt_idx" ON "LoginAttempt"("identifierHash", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_userId_createdAt_idx" ON "LoginAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Group_status_idx" ON "Group"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE INDEX "GroupAdminAssignment_groupId_active_idx" ON "GroupAdminAssignment"("groupId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAdminAssignment_userId_groupId_key" ON "GroupAdminAssignment"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_userId_key" ON "MemberProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_phoneE164_key" ON "MemberProfile"("phoneE164");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_memberNumber_key" ON "MemberProfile"("memberNumber");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_status_idx" ON "GroupMembership"("groupId", "status");

-- CreateIndex
CREATE INDEX "GroupMembership_memberProfileId_status_idx" ON "GroupMembership"("memberProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_memberProfileId_key" ON "GroupMembership"("groupId", "memberProfileId");

-- CreateIndex
CREATE INDEX "RegistrationFee_groupId_status_idx" ON "RegistrationFee"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationFee_groupId_memberProfileId_key" ON "RegistrationFee"("groupId", "memberProfileId");

-- CreateIndex
CREATE INDEX "SavingsAccount_memberProfileId_idx" ON "SavingsAccount"("memberProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsAccount_groupId_memberProfileId_key" ON "SavingsAccount"("groupId", "memberProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsTransaction_reference_key" ON "SavingsTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsTransaction_reversalOfId_key" ON "SavingsTransaction"("reversalOfId");

-- CreateIndex
CREATE INDEX "SavingsTransaction_createdAt_idx" ON "SavingsTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsTransaction_savingsAccountId_contributionWeek_key" ON "SavingsTransaction"("savingsAccountId", "contributionWeek");

-- CreateIndex
CREATE INDEX "CashLoan_groupId_status_dueDate_idx" ON "CashLoan"("groupId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "CashLoan_memberProfileId_status_idx" ON "CashLoan"("memberProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CashLoanPayment_reference_key" ON "CashLoanPayment"("reference");

-- CreateIndex
CREATE INDEX "CashLoanPayment_cashLoanId_paymentDate_idx" ON "CashLoanPayment"("cashLoanId", "paymentDate");

-- CreateIndex
CREATE INDEX "LoanFine_status_idx" ON "LoanFine"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LoanFine_cashLoanId_ruleVersion_key" ON "LoanFine"("cashLoanId", "ruleVersion");

-- CreateIndex
CREATE INDEX "Item_groupId_status_availableFrom_availableUntil_idx" ON "Item"("groupId", "status", "availableFrom", "availableUntil");

-- CreateIndex
CREATE INDEX "ItemLoan_groupId_status_idx" ON "ItemLoan"("groupId", "status");

-- CreateIndex
CREATE INDEX "ItemLoan_memberProfileId_status_idx" ON "ItemLoan"("memberProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ItemLoanPayment_reference_key" ON "ItemLoanPayment"("reference");

-- CreateIndex
CREATE INDEX "ItemLoanPayment_itemLoanId_paymentDate_idx" ON "ItemLoanPayment"("itemLoanId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_idempotencyKey_key" ON "FinancialLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialLedgerEntry_reversalOfId_key" ON "FinancialLedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_groupId_category_createdAt_idx" ON "FinancialLedgerEntry"("groupId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_memberProfileId_category_createdAt_idx" ON "FinancialLedgerEntry"("memberProfileId", "category", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");

-- CreateIndex
CREATE INDEX "FileAsset_purpose_createdAt_idx" ON "FileAsset"("purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MemberAgreement_fileAssetId_key" ON "MemberAgreement"("fileAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberAgreement_supersedesId_key" ON "MemberAgreement"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberAgreement_memberProfileId_version_key" ON "MemberAgreement"("memberProfileId", "version");

-- CreateIndex
CREATE INDEX "AgreementSignature_memberAgreementId_signedAt_idx" ON "AgreementSignature"("memberAgreementId", "signedAt");

-- CreateIndex
CREATE INDEX "ChatConversation_groupId_type_idx" ON "ChatConversation"("groupId", "type");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_conversationId_clientMessageId_key" ON "ChatMessage"("conversationId", "clientMessageId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_status_severity_detectedAt_idx" ON "SecurityEvent"("status", "severity", "detectedAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_subjectUserId_detectedAt_idx" ON "SecurityEvent"("subjectUserId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_entryHash_key" ON "AuditLog"("entryHash");

-- CreateIndex
CREATE INDEX "AuditLog_occurredAt_idx" ON "AuditLog"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_occurredAt_idx" ON "AuditLog"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_occurredAt_idx" ON "AuditLog"("targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_fileAssetId_key" ON "Report"("fileAssetId");

-- CreateIndex
CREATE INDEX "Report_requestedById_status_idx" ON "Report"("requestedById", "status");

-- CreateIndex
CREATE INDEX "Report_groupId_status_idx" ON "Report"("groupId", "status");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MFAFactor" ADD CONSTRAINT "MFAFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAdminAssignment" ADD CONSTRAINT "GroupAdminAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAdminAssignment" ADD CONSTRAINT "GroupAdminAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFee" ADD CONSTRAINT "RegistrationFee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationFee" ADD CONSTRAINT "RegistrationFee_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsTransaction" ADD CONSTRAINT "SavingsTransaction_savingsAccountId_fkey" FOREIGN KEY ("savingsAccountId") REFERENCES "SavingsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLoan" ADD CONSTRAINT "CashLoan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLoan" ADD CONSTRAINT "CashLoan_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLoan" ADD CONSTRAINT "CashLoan_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashLoanPayment" ADD CONSTRAINT "CashLoanPayment_cashLoanId_fkey" FOREIGN KEY ("cashLoanId") REFERENCES "CashLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanFine" ADD CONSTRAINT "LoanFine_cashLoanId_fkey" FOREIGN KEY ("cashLoanId") REFERENCES "CashLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLoan" ADD CONSTRAINT "ItemLoan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLoan" ADD CONSTRAINT "ItemLoan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLoan" ADD CONSTRAINT "ItemLoan_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemLoanPayment" ADD CONSTRAINT "ItemLoanPayment_itemLoanId_fkey" FOREIGN KEY ("itemLoanId") REFERENCES "ItemLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAgreement" ADD CONSTRAINT "MemberAgreement_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAgreement" ADD CONSTRAINT "MemberAgreement_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAgreement" ADD CONSTRAINT "MemberAgreement_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementSignature" ADD CONSTRAINT "AgreementSignature_memberAgreementId_fkey" FOREIGN KEY ("memberAgreementId") REFERENCES "MemberAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementSignature" ADD CONSTRAINT "AgreementSignature_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
