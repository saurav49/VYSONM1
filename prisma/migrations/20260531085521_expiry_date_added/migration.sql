-- AlterTable
ALTER TABLE "UrlShortener" ADD COLUMN     "expiryDate" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMPTZ(6);
