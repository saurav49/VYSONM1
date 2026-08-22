-- CreateTable
CREATE TABLE "ImageProcessingAggregate" (
    "taskId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "thumbnailReady" BOOLEAN NOT NULL DEFAULT false,
    "safetyCheckCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notificationTriggered" BOOLEAN NOT NULL DEFAULT false,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageProcessingAggregate_pkey" PRIMARY KEY ("taskId")
);
