-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('HOBBY', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tier" "Tier" NOT NULL DEFAULT 'HOBBY';
