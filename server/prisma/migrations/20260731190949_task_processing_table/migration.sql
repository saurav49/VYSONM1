-- CreateTable
CREATE TABLE "ProcessedTask" (
    "taskId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event" TEXT NOT NULL,

    CONSTRAINT "ProcessedTask_pkey" PRIMARY KEY ("taskId")
);
