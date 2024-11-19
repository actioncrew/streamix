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
  harmonize: boolean;
  run(): void;
  enqueue(event: BusEvent): void;
  name?: string;
};

export function createBus(config?: {bufferSize?: number, harmonize?: boolean}): Bus {

  const bufferSize = config?.bufferSize || 64; // Adjust buffer size as needed
  const harmonize = config?.harmonize || false; // Adjust buffer size as needed

  const buffer: Array<BusEvent | null> = new Array(bufferSize).fill(null);
  const pendingEmissions: Map<any, Set<Emission>> = new Map();

  let head = 0;
  let tail = 0;

  const lock = createLock();
  const itemsAvailable = createSemaphore(0); // Semaphore for items available in the buffer
  const spaceAvailable = createSemaphore(bufferSize); // Semaphore for available space in the buffer

  const bus: Bus = {
    harmonize,
    async run(): Promise<void> {
      while (true) {
        // Wait for an available item or space in the buffer
        await itemsAvailable.acquire(); // Wait for an item to be available

        const event = buffer[head];
        if (event) {
         // Process the event here (you can call your handler based on event type)
          switch(event.type) {
            case 'start':
              event.target.onStart.parallel(event.payload); break;
            case 'stop':
              Promise.all(Array.from(pendingEmissions.get(event.target)!).map(emission => emission.wait()))
                .then(() => event.target.onStop.parallel(event.payload));
              break;
            case 'emission':
              event.target.onEmission.parallel(event.payload).then(() => {
                if(event.payload?.emission?.complete || event.payload?.emission?.phantom) {
                  event.payload.emission.resolve();
                }

                if(pendingEmissions.has(event.target)) {
                  const pendingSet = pendingEmissions.get(event.target);
                  const stillPending = Array.from(pendingSet!).filter(emission => emission.pending);
                  pendingEmissions.set(event.target, new Set(stillPending));
                }

                if (event.target && event.payload?.emission?.pending) {
                  let set = pendingEmissions.get(event.target) ?? new Set();
                  if(!set.has(event.payload.emission)) {
                    set.add(event.payload.emission);
                  }
                  pendingEmissions.set(event.target, set);
                }
              }); break;
            case 'complete':
              Promise.all(Array.from(pendingEmissions.get(event.target)!).map(emission => emission.wait()))
                .then(() => event.target.onComplete.parallel(event.payload));
              break;
            case 'error':
              event.target.onError.parallel(event.payload); break;
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
