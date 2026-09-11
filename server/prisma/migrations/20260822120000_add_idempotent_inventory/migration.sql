-- Inventory state and an event-id keyed reservation ledger. The primary key on
-- eventId is the idempotency constraint used by the inventory consumer.
CREATE TABLE "InventoryItem" (
    "sku" TEXT NOT NULL,
    "availableQuantity" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("sku"),
    CONSTRAINT "InventoryItem_availableQuantity_check"
      CHECK ("availableQuantity" >= 0)
);

CREATE TABLE "InventoryReservation" (
    "eventId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("eventId"),
    CONSTRAINT "InventoryReservation_quantity_check" CHECK ("quantity" > 0)
);

CREATE INDEX "InventoryReservation_orderId_idx"
ON "InventoryReservation"("orderId");
