import { describe, expect, it } from 'bun:test';
import {
  reserveInventoryExactlyOnce,
  type InventoryStore,
  type ReserveInventoryEvent,
} from '../modules/inventory/inventory.repository';

function createInventoryStore(initialQuantity: number) {
  let availableQuantity = initialQuantity;
  const processedEvents = new Set<string>();

  const store: InventoryStore = {
    $transaction: async (operation) => {
      const transactionEvents = new Set(processedEvents);
      let transactionQuantity = availableQuantity;

      const result = await operation({
        inventoryReservation: {
          createMany: async ({ data }) => {
            if (transactionEvents.has(data.eventId)) return { count: 0 };
            transactionEvents.add(data.eventId);
            return { count: 1 };
          },
        },
        inventoryItem: {
          updateMany: async (args: unknown) => {
            const input = args as {
              where: { availableQuantity: { gte: number } };
              data: { availableQuantity: { decrement: number } };
            };
            const quantity = input.where.availableQuantity.gte;
            if (transactionQuantity < quantity) return { count: 0 };
            transactionQuantity -= input.data.availableQuantity.decrement;
            return { count: 1 };
          },
        },
      });

      processedEvents.clear();
      for (const eventId of transactionEvents) processedEvents.add(eventId);
      availableQuantity = transactionQuantity;
      return result;
    },
  };

  return {
    store,
    quantity: () => availableQuantity,
    wasProcessed: (eventId: string) => processedEvents.has(eventId),
  };
}

const event: ReserveInventoryEvent = {
  eventId: 'event-1',
  orderId: 'order-1',
  sku: 'sku-1',
  quantity: 3,
};

describe('idempotent inventory reservation', () => {
  it('decrements inventory once when an event is delivered twice', async () => {
    const inventory = createInventoryStore(10);

    expect(await reserveInventoryExactlyOnce(event, inventory.store)).toBe(
      'reserved',
    );
    expect(await reserveInventoryExactlyOnce(event, inventory.store)).toBe(
      'already-processed',
    );
    expect(inventory.quantity()).toBe(7);
  });

  it('rolls back the event claim when inventory is insufficient', async () => {
    const inventory = createInventoryStore(2);

    await expect(
      reserveInventoryExactlyOnce(event, inventory.store),
    ).rejects.toThrow('Insufficient inventory');

    expect(inventory.quantity()).toBe(2);
    expect(inventory.wasProcessed(event.eventId)).toBe(false);
  });
});
