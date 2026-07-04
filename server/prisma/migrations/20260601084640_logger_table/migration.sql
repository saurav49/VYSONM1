-- CreateTable
CREATE TABLE "RequestLogging" (
    "id" SERIAL NOT NULL,
    "method" TEXT,
    "timestamp" TEXT,
    "userAgent" TEXT,
    "url" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestLogging_pkey" PRIMARY KEY ("id")
);
