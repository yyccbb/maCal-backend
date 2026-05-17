-- AlterTable
ALTER TABLE "Calendar" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Device" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScheduleItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SyncChange" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" DROP DEFAULT;
