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

export function isBusEvent(obj: any): obj is BusEvent {
  return (
    obj &&
    typeof obj === 'object' &&
    'target' in obj &&
    'type' in obj &&
    typeof obj.type === 'string'
  );
}

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
      function trackPendingEmission(target: any, emission: Emission): void {
        const pendingSet = pendingEmissions.get(target) || new Set();
        if (!pendingSet.has(emission)) {
          pendingSet.add(emission);
          pendingEmissions.set(target, pendingSet);
        }

        emission.wait().then(async () => {
          pendingSet.delete(emission);
          if (pendingSet.size === 0) {
            pendingEmissions.delete(target);

            // Process `onComplete` marker first if it exists
            if (completeMarkers.has(target)) {
              const payload = completeMarkers.get(target);
              completeMarkers.delete(target);
              const completeEvents = (await target[hooks].onComplete.parallel(payload)).filter((fn: any) => fn instanceof Function);
              for (const event of completeEvents) {
                await processEvent(event());
              }
            }

            // Only process `onStop` marker after `onComplete`
            if (stopMarkers.has(target)) {
              const payload = stopMarkers.get(target);
              stopMarkers.delete(target);
              const stopEvents = (await target[hooks].onStop.parallel(payload)).filter((fn: any) => fn instanceof Function);
              for (const event of stopEvents) {
                await processEvent(event());
              }
            }
          }
        });
      };

      async function processEvent(event: BusEvent): Promise<void> {
        switch (event.type) {
          case 'start':
            const emissionEvents = (await event.target[hooks].onStart.parallel(event.payload)).filter((fn: any) => fn instanceof Function);
            for (const emissionEvent of emissionEvents) {
              await processEvent(emissionEvent());
            }
            break;
          case 'stop':
            if (!pendingEmissions.has(event.target)) {
              const emissionEvents = (await event.target[hooks].onStop.parallel(event.payload)).filter((fn: any) => fn instanceof Function);
              for (const emissionEvent of emissionEvents) {
                await processEvent(emissionEvent());
              }
            } else {
              stopMarkers.set(event.target, event.payload);
            }
            break;
          case 'emission':
            let emission = event.payload?.emission ?? createEmission({});
            const target = event.target;

            if (target[flags].isStopRequested && completeMarkers.has(target)) {
              emission.phantom = true;
              emission.ancestor?.finalize();
            } else {
              const emissionEvents = (await target[hooks].onEmission.parallel(event.payload)).filter((fn: any) => fn instanceof Function);
              for (const emissionEvent of emissionEvents) {
                await processEvent(emissionEvent());
              }
            }

            if (emission.pending) {
              trackPendingEmission(target, emission);
            }
            break;
          case 'complete':
            if (!pendingEmissions.has(event.target)) {
              const completeEvents = (await event.target[hooks].onComplete.parallel(event.payload)).filter((fn: any) => fn instanceof Function);
              for (const completeEvent of completeEvents) {
                await processEvent(completeEvent());
              }
            } else {
              completeMarkers.set(event.target, event.payload);
            }
            break;
          case 'error':
            const errorEvents = (await event.target[hooks].onError.parallel(event.payload)).filter((fn: any) => fn instanceof Function);
            for (const errorEvent of errorEvents) {
              await processEvent(errorEvent());
            }
            break;
        }
      }

      while (true) {
        // Wait for an available item in the buffer
        await itemsAvailable.acquire();

        const event = buffer[head];
        if (event) {
          // Process the current event
          await processEvent(event);

          // Move head forward in the buffer and release space
          head = (head + 1) % bufferSize;
          spaceAvailable.release();
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
