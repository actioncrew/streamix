import { createLock, createSemaphore } from '../utils';
import { Emission } from './emission';

export const eventBus = createBus() as Bus;
eventBus.run();

export type BusEvent = {
  target: any;
  type: 'emission' | 'start' | 'stop' | 'complete' | 'error' | 'subscribers';
  payload?: any;
  timeStamp?: Date;
};

export type Bus = {
  run(): void;
  enqueue(event: BusEvent): void;
  name?: string;
};

export function createBus(): Bus {

  const bufferSize = 64; // Adjust buffer size as needed
  const buffer: Array<BusEvent | null> = new Array(bufferSize).fill(null);
  const pendingEmissions: Map<any, Set<Emission>> = new Map();

  let head = 0;
  let tail = 0;

  const lock = createLock();
  const itemsAvailable = createSemaphore(0); // Semaphore for items available in the buffer
  const spaceAvailable = createSemaphore(bufferSize); // Semaphore for available space in the buffer

  const bus: Bus = {
    async run(): Promise<void> {
      while (true) {
        // Wait for an available item or space in the buffer
        await itemsAvailable.acquire(); // Wait for an item to be available

        const event = buffer[head];
        if (event) {
         // Process the event here (you can call your handler based on event type)
          switch(event.type) {
            case 'start': await event.target.onStart.parallel(event.payload); break;
            case 'stop': await event.target.onStop.parallel(event.payload); break;
            case 'emission': await event.target.onEmission.parallel(event.payload); break;
            case 'complete': await event.target.onComplete.parallel(event.payload); break;
            case 'error': await event.target.onError.parallel(event.payload); break;
          }

          if (event.target && event.payload?.emission?.pending) {
            let set = pendingEmissions.get(event.target) ?? new Set();
            if(!set.has(event.payload.emission)) {
              set.add(event.payload.emission);
            }
            pendingEmissions.set(event.target, set);
          }

          // Move head forward in the buffer and reduce the available item count
          head = (head + 1) % bufferSize;
          spaceAvailable.release(); // Release the space in the buffer
        }
      }
    },

    async enqueue(event: BusEvent): Promise<void> {
      const releaseLock = await lock.acquire();

      try {
        await spaceAvailable.acquire(); // Wait until space is available in the buffer
        event.timeStamp = new Date(); // Add timestamp for the event

        // Place the event into the buffer and update the tail position
        buffer[tail] = event;
        tail = (tail + 1) % bufferSize;

        // Release the semaphore to notify the consumer that an item is available
        itemsAvailable.release();
      } finally {
        releaseLock(); // Always release the lock to avoid blocking other operations
      }
    },
  };

  bus.name = 'bus';

  return bus;
}
