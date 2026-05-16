CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ScheduleItemType" AS ENUM ('EVENT', 'REMINDER');
CREATE TYPE "ScheduleItemStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('PUSH', 'EMAIL', 'SMS', 'LOCAL');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'WEB', 'ANDROID', 'HARMONYOS');
CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "account" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Calendar" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "calendarId" UUID,
  "type" "ScheduleItemType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startTime" TIMESTAMP(3),
  "endTime" TIMESTAMP(3),
  "reminderTime" TIMESTAMP(3),
  "timezone" TEXT NOT NULL,
  "recurrenceRule" TEXT,
  "status" "ScheduleItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceText" TEXT,
  "aiConfidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "scheduleItemId" UUID NOT NULL,
  "triggerTime" TIMESTAMP(3) NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Device" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "platform" "DevicePlatform" NOT NULL,
  "pushProvider" TEXT,
  "pushToken" TEXT,
  "timezone" TEXT NOT NULL,
  "appVersion" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncChange" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" UUID NOT NULL,
  "operation" "SyncOperation" NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_account_key" ON "User"("account");
CREATE INDEX "Calendar_userId_idx" ON "Calendar"("userId");
CREATE INDEX "ScheduleItem_userId_startTime_idx" ON "ScheduleItem"("userId", "startTime");
CREATE INDEX "ScheduleItem_userId_reminderTime_idx" ON "ScheduleItem"("userId", "reminderTime");
CREATE INDEX "ScheduleItem_userId_status_idx" ON "ScheduleItem"("userId", "status");
CREATE INDEX "ScheduleItem_calendarId_idx" ON "ScheduleItem"("calendarId");
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");
CREATE INDEX "Notification_scheduleItemId_idx" ON "Notification"("scheduleItemId");
CREATE INDEX "Notification_triggerTime_idx" ON "Notification"("triggerTime");
CREATE INDEX "Device_userId_idx" ON "Device"("userId");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE UNIQUE INDEX "SyncChange_userId_version_key" ON "SyncChange"("userId", "version");
CREATE INDEX "SyncChange_userId_version_idx" ON "SyncChange"("userId", "version");
CREATE INDEX "SyncChange_entityType_entityId_idx" ON "SyncChange"("entityType", "entityId");

ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "Calendar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_scheduleItemId_fkey" FOREIGN KEY ("scheduleItemId") REFERENCES "ScheduleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncChange" ADD CONSTRAINT "SyncChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
