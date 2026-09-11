import { TaskQueueAction } from './enums';
import { generateThumbnail, logUpload, notifyAdmin } from './util';
import Redis from 'ioredis';

const publisher = new Redis({
  host: 'localhost',
  port: 6379,
});

const subscriber = new Redis({
  host: 'localhost',
  port: 6379,
});

subscriber.on('message', async (channel, message) => {
  if (channel !== TaskQueueAction.IMAGE_UPLOAD) return;
  const data = JSON.parse(message);

  await Promise.all([generateThumbnail(data), logUpload(), notifyAdmin()]);
});
// class PubSub {
//   private subscribers: Record<
//     TaskQueueAction,
//     ((data: any) => Promise<void> | void)[]
//   > = {} as Record<TaskQueueAction, ((data: any) => Promise<void> | void)[]>;
//   constructor() {}

//   subscribe(event: TaskQueueAction, fn: (data: any) => void) {
//     if (!this.subscribers[event]) {
//       this.subscribers[event] = [fn];
//       return;
//     }
//     this.subscribers[event] = [...this.subscribers[event], fn];
//   }

//   publish(event: TaskQueueAction, data: any) {
//     const fns = this.subscribers[event] ?? [];
//     void Promise.all(fns.map((fn: (data: any) => void) => fn(data))).catch(
//       (e) => {
//         console.error(`PubSub event ${event} failed`);
//       },
//     );
//   }
// }

// const pb = new PubSub();

// pb.subscribe(TaskQueueAction.IMAGE_UPLOAD, generateThumbnail);
// pb.subscribe(TaskQueueAction.IMAGE_UPLOAD, logUpload);
// pb.subscribe(TaskQueueAction.IMAGE_UPLOAD, notifyAdmin);

export { publisher, subscriber };
