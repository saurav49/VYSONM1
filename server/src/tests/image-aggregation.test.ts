import { describe, expect, it } from 'bun:test';
import {
  markImageStepCompleted,
  handleImageAggregationTimeout,
  type ImageAggregationDependencies,
  type ImageAggregationStep,
  type ImageTimeoutDependencies,
  type ImageTimeoutOutcome,
} from '../utils/image-aggregation';

function createAggregationHarness() {
  const state = {
    thumbnailReady: false,
    safetyCheckCompleted: false,
    notificationTriggered: false,
  };
  const notifications: string[] = [];
  let failNextNotification = false;

  const dependencies: ImageAggregationDependencies = {
    updateAndClaim: async (
      _taskId: string,
      _userId: number,
      step: ImageAggregationStep,
    ) => {
      if (step === 'thumbnail') state.thumbnailReady = true;
      if (step === 'safety') state.safetyCheckCompleted = true;

      if (
        state.thumbnailReady &&
        state.safetyCheckCompleted &&
        !state.notificationTriggered
      ) {
        state.notificationTriggered = true;
        return true;
      }

      return false;
    },
    enqueueNotification: async (taskId) => {
      if (failNextNotification) {
        failNextNotification = false;
        throw new Error('queue unavailable');
      }
      notifications.push(taskId);
    },
    releaseClaim: async () => {
      state.notificationTriggered = false;
    },
  };

  return {
    dependencies,
    notifications,
    state,
    failNextNotification: () => {
      failNextNotification = true;
    },
  };
}

describe('image processing event aggregation', () => {
  it.each([
    ['thumbnail', 'safety'],
    ['safety', 'thumbnail'],
  ] as const)(
    'notifies once when %s completes before %s',
    async (first, second) => {
      const harness = createAggregationHarness();

      await markImageStepCompleted(
        'task-1',
        42,
        first,
        harness.dependencies,
      );
      expect(harness.notifications).toHaveLength(0);

      await markImageStepCompleted(
        'task-1',
        42,
        second,
        harness.dependencies,
      );
      await markImageStepCompleted(
        'task-1',
        42,
        second,
        harness.dependencies,
      );

      expect(harness.notifications).toEqual(['task-1']);
    },
  );

  it('releases the claim when notification queueing fails', async () => {
    const harness = createAggregationHarness();
    harness.failNextNotification();

    await markImageStepCompleted(
      'task-2',
      42,
      'thumbnail',
      harness.dependencies,
    );
    await expect(
      markImageStepCompleted('task-2', 42, 'safety', harness.dependencies),
    ).rejects.toThrow('queue unavailable');

    expect(harness.state.notificationTriggered).toBe(false);

    await markImageStepCompleted(
      'task-2',
      42,
      'safety',
      harness.dependencies,
    );
    expect(harness.notifications).toEqual(['task-2']);
  });
});

describe('image processing aggregation timeout', () => {
  function timeoutDependencies(
    outcome: ImageTimeoutOutcome,
    failDispatch = false,
  ) {
    const dispatched: string[] = [];
    const released: string[] = [];
    const dependencies: ImageTimeoutDependencies = {
      claimOutcome: async () => outcome,
      enqueueCompletion: async (taskId) => {
        if (failDispatch) throw new Error('queue unavailable');
        dispatched.push(`completed:${taskId}`);
      },
      enqueueManualReview: async (taskId) => {
        if (failDispatch) throw new Error('queue unavailable');
        dispatched.push(`manual-review:${taskId}`);
      },
      releaseOutcome: async (_taskId, _userId, claimedOutcome) => {
        released.push(claimedOutcome);
      },
    };
    return { dependencies, dispatched, released };
  }

  it('triggers manual review when the deadline outcome is incomplete', async () => {
    const harness = timeoutDependencies('manual-review');

    await handleImageAggregationTimeout(
      'task-3',
      42,
      new Date(),
      harness.dependencies,
    );

    expect(harness.dispatched).toEqual(['manual-review:task-3']);
  });

  it('does nothing when another worker already claimed an outcome', async () => {
    const harness = timeoutDependencies(null);

    await handleImageAggregationTimeout(
      'task-4',
      42,
      new Date(),
      harness.dependencies,
    );

    expect(harness.dispatched).toHaveLength(0);
  });

  it('releases a timeout outcome when downstream dispatch fails', async () => {
    const harness = timeoutDependencies('manual-review', true);

    await expect(
      handleImageAggregationTimeout(
        'task-5',
        42,
        new Date(),
        harness.dependencies,
      ),
    ).rejects.toThrow('queue unavailable');

    expect(harness.released).toEqual(['manual-review']);
  });
});
