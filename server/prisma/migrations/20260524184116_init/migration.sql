-- CreateTable
CREATE TABLE "UrlShortener" (
    "id" SERIAL NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrlShortener_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UrlShortener_originalUrl_key" ON "UrlShortener"("originalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "UrlShortener_shortCode_key" ON "UrlShortener"("shortCode");
