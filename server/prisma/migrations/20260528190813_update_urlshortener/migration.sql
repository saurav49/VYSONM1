-- AlterTable
ALTER TABLE "UrlShortener" ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAccessedAt" TIMESTAMPTZ(6);
