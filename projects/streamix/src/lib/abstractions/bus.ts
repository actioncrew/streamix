import { createLock, createSemaphore } from '../utils';
import { createEmission, Emission } from './emission';
import { flags, hooks } from './subscribable';

export const eventBus = createBus() as Bus;
eventBus.run();

export type BusEvent = {
  target: any;
  type: 'emission' | 'start' | 'stop' | 'complete' | 'error';
  payload?: any;
  timeStamp?: Date;
};

export type Bus = {
  run(): void;
  enqueue(event: BusEvent): void;
  name?: string;
};

export function createBus(config?: {bufferSize?: number, harmonize?: boolean}): Bus {

  const bufferSize = config?.bufferSize || 64; // Adjust buffer size as needed

  const buffer: Array<BusEvent | null> = new Array(bufferSize).fill(null);
  const pendingEmissions: Map<any, Set<Emission>> = new Map();
  const stopMarkers: Map<any, any> = new Map();
  const completeMarkers: Map<any, any> = new Map();

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
            case 'start':
              await event.target[hooks].onStart.parallel(event.payload); break;
            case 'stop':
              if (!pendingEmissions.has(event.target)) {
                await event.target[hooks].onStop.parallel(event.payload); break;
              } else {
                stopMarkers.set(event.target, event.payload);
              }
              break;
            case 'emission':
              let emission = event.payload?.emission ?? createEmission({});
              let target = event.target;

              if(target[flags].isStopRequested && completeMarkers.has(target)) {
                emission.phantom = true;
                emission.ancestor?.finalize();
              } else {
                await target[hooks].onEmission.parallel(event.payload);
              }

              if(pendingEmissions.has(target)) {
                const pendingSet = pendingEmissions.get(target);
                const stillPending = Array.from(pendingSet!).filter(emission => emission.pending);
                pendingEmissions.set(target, new Set(stillPending));
              }

              if (target && emission.pending) {
                let set = pendingEmissions.get(target) ?? new Set();
                if(!set.has(emission)) {
                  set.add(emission);
                }
                pendingEmissions.set(target, set);

                emission.wait().then(async () => {
                  let set = pendingEmissions.get(target)!;
                  set.delete(emission);

                  if(!set.size) {
                    pendingEmissions.delete(target);
                  }

                  if(!set.size) {
                    if(completeMarkers.has(target)) {
                      const payload = completeMarkers.get(target);
                      completeMarkers.delete(target);
                      await target[hooks].onComplete.parallel(payload);
                    }

                    if(stopMarkers.has(target)) {
                      const payload = stopMarkers.get(target);
                      stopMarkers.delete(target);
                      await target[hooks].onStop.parallel(payload);
                    }
                  }
                });
              }
              break;
            case 'complete':
              if (!pendingEmissions.has(event.target)) {
                await event.target[hooks].onComplete.parallel(event.payload);
              } else {
                completeMarkers.set(event.target, true);
              }
              break;
            case 'error':
              await event.target[hooks].onError.parallel(event.payload); break;
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
