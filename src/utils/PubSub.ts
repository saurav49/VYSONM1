import { TaskQueueAction } from './enums';
import { generateThumbnail, logUpload, notifyAdmin } from './util';

class PubSub {
  private subscribers: Record<
    TaskQueueAction,
    ((data: any) => Promise<void> | void)[]
  > = {} as Record<TaskQueueAction, ((data: any) => Promise<void> | void)[]>;
  constructor() {}

  subscribe(event: TaskQueueAction, fn: (data: any) => void) {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [fn];
      return;
    }
    this.subscribers[event] = [...this.subscribers[event], fn];
  }

  publish(event: TaskQueueAction, data: any) {
    const fns = this.subscribers[event] ?? [];
    void Promise.all(fns.map((fn: (data: any) => void) => fn(data))).catch(
      (e) => {
        console.error(`PubSub event ${event} failed`);
      },
    );
  }
}

export const pb = new PubSub();

pb.subscribe(TaskQueueAction.IMAGE_UPLOAD, generateThumbnail);
pb.subscribe(TaskQueueAction.IMAGE_UPLOAD, logUpload);
pb.subscribe(TaskQueueAction.IMAGE_UPLOAD, notifyAdmin);
