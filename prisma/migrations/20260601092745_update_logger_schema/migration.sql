/*
  Warnings:

  - The `timestamp` column on the `RequestLogging` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "RequestLogging" DROP COLUMN "timestamp",
ADD COLUMN     "timestamp" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP;
