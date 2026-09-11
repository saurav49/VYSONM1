-- Add timeout outcome state to prevent normal completion and manual review
-- from both being triggered for the same correlated workflow.
ALTER TABLE "ImageProcessingAggregate"
ADD COLUMN "timedOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "manualReviewTriggered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "thumbnailCompletedAt" TIMESTAMP(3),
ADD COLUMN "safetyCheckCompletedAt" TIMESTAMP(3);
