import { prisma } from '../../lib/prisma';

type ReserveInventoryEvent = {
  eventId: string;
  orderId: string;
  sku: string;
  quantity: number;
};

type ReserveInventoryResult = 'reserved' | 'already-processed';

type InventoryTransaction = {
  inventoryReservation: {
    createMany: (args: {
      data: ReserveInventoryEvent;
      skipDuplicates: boolean;
    }) => Promise<{ count: number }>;
  };
  inventoryItem: {
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
};

type InventoryStore = {
  $transaction: <T>(
    operation: (tx: InventoryTransaction) => Promise<T>,
  ) => Promise<T>;
};

async function reserveInventoryExactlyOnce(
  event: ReserveInventoryEvent,
  store: InventoryStore = prisma as unknown as InventoryStore,
): Promise<ReserveInventoryResult> {
  if (!event.eventId || !event.orderId || !event.sku) {
    throw new Error('eventId, orderId, and sku are required');
  }
  if (!Number.isInteger(event.quantity) || event.quantity <= 0) {
    throw new Error('quantity must be a positive integer');
  }

  return store.$transaction(async (tx) => {
    const claimed = await tx.inventoryReservation.createMany({
      data: event,
      skipDuplicates: true,
    });

    // The broker redelivered an event whose transaction already committed.
    if (claimed.count === 0) return 'already-processed';

    const updated = await tx.inventoryItem.updateMany({
      where: {
        sku: event.sku,
        availableQuantity: { gte: event.quantity },
      },
      data: {
        availableQuantity: { decrement: event.quantity },
      },
    });

    if (updated.count !== 1) {
      // Throwing rolls back the reservation claim too, allowing a legitimate
      // retry after stock is replenished or the event is corrected.
      throw new Error(`Insufficient inventory for SKU ${event.sku}`);
    }

    return 'reserved';
  });
}

export { reserveInventoryExactlyOnce };
export type {
  InventoryStore,
  InventoryTransaction,
  ReserveInventoryEvent,
  ReserveInventoryResult,
};
