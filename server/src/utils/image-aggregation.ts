type ImageAggregationStep = 'thumbnail' | 'safety';

type ImageAggregationDependencies = {
  updateAndClaim: (
    taskId: string,
    userId: number,
    step: ImageAggregationStep,
  ) => Promise<boolean>;
  enqueueNotification: (taskId: string, userId: number) => Promise<void>;
  releaseClaim: (taskId: string, userId: number) => Promise<void>;
};

type ImageTimeoutOutcome = 'completed' | 'manual-review' | null;

type ImageTimeoutDependencies = {
  claimOutcome: (
    taskId: string,
    userId: number,
    now: Date,
  ) => Promise<ImageTimeoutOutcome>;
  enqueueCompletion: (taskId: string, userId: number) => Promise<void>;
  enqueueManualReview: (taskId: string, userId: number) => Promise<void>;
  releaseOutcome: (
    taskId: string,
    userId: number,
    outcome: Exclude<ImageTimeoutOutcome, null>,
  ) => Promise<void>;
};

async function markImageStepCompleted(
  taskId: string,
  userId: number,
  step: ImageAggregationStep,
  dependencies: ImageAggregationDependencies,
) {
  const shouldNotify = await dependencies.updateAndClaim(taskId, userId, step);
  if (!shouldNotify) return;

  try {
    await dependencies.enqueueNotification(taskId, userId);
  } catch (error) {
    await dependencies.releaseClaim(taskId, userId);
    throw error;
  }
}

async function handleImageAggregationTimeout(
  taskId: string,
  userId: number,
  now: Date,
  dependencies: ImageTimeoutDependencies,
) {
  const outcome = await dependencies.claimOutcome(taskId, userId, now);
  if (!outcome) return;

  try {
    if (outcome === 'completed') {
      await dependencies.enqueueCompletion(taskId, userId);
    } else {
      await dependencies.enqueueManualReview(taskId, userId);
    }
  } catch (error) {
    await dependencies.releaseOutcome(taskId, userId, outcome);
    throw error;
  }
}

export { handleImageAggregationTimeout, markImageStepCompleted };
export type {
  ImageAggregationDependencies,
  ImageAggregationStep,
  ImageTimeoutDependencies,
  ImageTimeoutOutcome,
};
