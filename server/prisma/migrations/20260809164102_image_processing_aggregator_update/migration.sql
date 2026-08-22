-- Index aggregates by their processing deadline so expired workflows can be
-- discovered efficiently by a timeout/reconciliation worker.
CREATE INDEX "ImageProcessingAggregate_deadlineAt_idx"
ON "ImageProcessingAggregate"("deadlineAt");
