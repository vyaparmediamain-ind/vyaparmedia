-- AlterEnum
ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'SCOUT';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ScoutVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ScoutProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scoutCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "college" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "panDocumentUrl" TEXT,
    "aadhaarDocumentUrl" TEXT,
    "verificationStatus" "ScoutVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "royaltyPercent" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isRoyaltyPaused" BOOLEAN NOT NULL DEFAULT false,
    "royaltyPausedReason" TEXT,
    "monthlyQuotaExemptUntil" TIMESTAMP(3),
    "lastActiveMonth" TEXT,
    "streakMonths" INTEGER NOT NULL DEFAULT 0,
    "totalRoyaltyEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ScoutProfile_userId_key" ON "ScoutProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ScoutProfile_scoutCode_key" ON "ScoutProfile"("scoutCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScoutProfile_verificationStatus_idx" ON "ScoutProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScoutProfile_city_idx" ON "ScoutProfile"("city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScoutProfile_scoutCode_idx" ON "ScoutProfile"("scoutCode");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ScoutProfile" ADD CONSTRAINT "ScoutProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
