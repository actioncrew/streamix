import { createLock, createSemaphore } from '../utils';
import { Emission } from './emission';
import { isStream } from '../abstractions';

export const eventBus = createBus() as Bus;
eventBus.run();

export type BusEvent = {
  target: any;
  type: 'emission' | 'start' | 'stop' | 'complete' | 'error';
  payload?: any;
  timeStamp?: Date;
};

export type Bus = {
  name?: string;
  run(): void;
  enqueue(event: BusEvent): void;
  harmonize: boolean;
};

export function createBus(config?: {bufferSize?: number, harmonize?: boolean}): Bus {

  const bufferSize = config?.bufferSize || 64; // Adjust buffer size as needed
  const harmonize = config?.harmonize || false; // Adjust harmonize flag as needed

  const buffer: Array<BusEvent | null> = new Array(bufferSize).fill(null);
  const pendingEmissions: Map<any, Set<Emission>> = new Map();
  const stopMarkers: Map<any, any> = new Map();
  const completeMarkers: Map<any, any> = new Map();

  let head = 0;
  let tail = 0;

  const lock = createLock();
  const itemsAvailable = createSemaphore(0); // Semaphore for items available in the buffer
  const spaceAvailable = createSemaphore(bufferSize); // Semaphore for available space in the buffer

  const runSymbol = Symbol('run');
  const enqueueSymbol = Symbol('enqueue');
  
  const bus = {
    async [runSymbol](this: any): Promise<void> {
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
              if (!pendingEmissions.has(event.target)) {
                await event.target.onStop.parallel(event.payload); break;
              } else {
                stopMarkers.set(event.target, event.payload);
              }
              break;
            case 'emission':
              let emission = event.payload?.emission || createEmission({});
              let target = event.target;

              // if(target.isStopRequested && completeMarkers.has(event.target)) {
              //   if(emission) {
              //     emission.ancestor?.finalize();
              //     emission.phantom = true;
              //  }
              // }
              
              await target.onEmission.parallel(event.payload);

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
                      await target.onComplete.parallel(payload);
                    }

                    if(stopMarkers.has(target)) {
                      const payload = stopMarkers.get(target);
                      stopMarkers.delete(target);
                      await target.onStop.parallel(payload);
                    }
                  }
                });
              }

              break;
            case 'complete':
              if (!pendingEmissions.has(event.target)) {
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

    async [enqueueSymbol](this: any, event: BusEvent): Promise<void> {
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
  
  return {
    name: 'bus',
    harmonize: false,
    run: async function(this: any): Promise<void> {
      if (this !== bus) {
        throw new Error("Indirect calls to 'run' are not allowed.");
      }
      return bus[runSymbol]();
    },
    enqueue: async function(this: any, event: BusEvent): Promise<void> {
      if (this === bus) {
        throw new Error("Direct call to 'enqueue' is not allowed. Use 'enqueue.call' with a valid stream.");
      }

      if (!isStream(this)) {
        throw new Error("Invalid 'this' context. 'enqueue' must be called with a stream as 'this'.");
      }
      
      // Delegate to the symbol-protected internal method
      bus[enqueueSymbol](event);
    }
  } as Bus;
}
