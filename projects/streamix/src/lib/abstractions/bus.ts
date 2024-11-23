import { createLock, createSemaphore } from '../utils';
import { Emission } from './emission';
import { isStream } from '../abstractions';

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
  const stopMarkers: Map<any, any> = new Map();
  const completeMarkers: Map<any, any> = new Map();

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
              await event.target.onStart.parallel(event.payload); break;
            case 'stop':
              if (!pendingEmissions.get(event.target)?.size) {
                await event.target.onStop.parallel(event.payload); break;
              } else {
                stopMarkers.set(event.target, event.payload);
              }
              break;
            case 'emission':
              if(event.target.isStopRequested && completeMarkers.has(event.target)) {
                if(event.payload && event.payload.emission) {
                  event.payload.emission.ancestor?.finalize();
                  event.payload.emission.phantom = true;
                }
              }

              await event.target.onEmission.parallel(event.payload);

              if(pendingEmissions.has(event.target)) {
                const pendingSet = pendingEmissions.get(event.target);
                const stillPending = Array.from(pendingSet!).filter(emission => emission.pending);
                pendingEmissions.set(event.target, new Set(stillPending));
              }

              if (event.target && event.payload?.emission?.pending) {
                let emission = event.payload.emission;
                let set = pendingEmissions.get(event.target) ?? new Set();
                if(!set.has(emission)) {
                  set.add(emission);
                }
                pendingEmissions.set(event.target, set);

                emission.wait().then(async () => {
                  let set = pendingEmissions.get(event.target)!;
                  set.delete(emission);

                  if(!set.size) {
                    pendingEmissions.delete(event.target);
                  }

                  if(!set.size) {
                    if(completeMarkers.has(event.target)) {
                      const payload = completeMarkers.get(event.target);
                      completeMarkers.delete(event.target);
                      await event.target.onComplete.parallel(payload);
                    }

                    if(stopMarkers.has(event.target)) {
                      const payload = stopMarkers.get(event.target);
                      stopMarkers.delete(event.target);
                      await event.target.onStop.parallel(payload);
                    }
                  }
                });
              }

              break;
            case 'complete':
              if (!pendingEmissions.get(event.target)?.size) {
                await event.target.onComplete.parallel(event.payload);
              } else {
                completeMarkers.set(event.target, true);
              }
              break;
            case 'error':
              await event.target.onError.parallel(event.payload); break;
          }

          // Move head forward in the buffer and reduce the available item count
          head = (head + 1) % bufferSize;
          spaceAvailable.release(); // Release the space in the buffer
        }
      }
    },

    async enqueue(this: any, event: BusEvent): Promise<void> {
      // Check if `this` is the eventBus itself (direct call)
      if (this === bus) {
        throw new Error("Direct call to 'enqueue' is not allowed. Use 'enqueue.call' with a valid stream.");
      }

      // Check if `this` is a valid stream (when using `.call` or `.apply`)
      if (!isStream(this)) {
        throw new Error("Unauthorized access to 'enqueue'. Caller must be a valid stream.");
      }
      
      const releaseLock = await lock.acquire();

      try {
        await spaceAvailable.acquire(); // Wait until space is available in the buffer
        event.timeStamp = new Date(); // Add timestamp for the event

        if(isStream(event.target) && event.type === 'emission') {
          event.target.emissionCounter++;
        }
        
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
