import { createLock, createSemaphore } from '../utils';
import { Emission } from './emission';
import { Subscribable } from './subscribable';

export const eventBus = createBus();

(async function startEventBus() {
  for await (const _ of eventBus.run()) {
    // Event consumption logic here (if needed)
  }
})();

export type BusEvent = {
  target: any;
  type: 'emission' | 'start' | 'finalize' | 'complete' | 'error';
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
  run(): AsyncGenerator<BusEvent>;
  enqueue(event: BusEvent): void;
  name?: string;
};

export function createBus(config?: { bufferSize?: number }): Bus {
  const bufferSize = config?.bufferSize || 64;
  const buffer: Array<BusEvent | null> = new Array(bufferSize).fill(null);

  const pendingEmissions = new Map<any, Set<Emission>>();
  const stopMarkers = new Map<any, any>();

  let head = 0;
  let tail = 0;

  const lock = createLock();
  const itemsAvailable = createSemaphore(0);
  const spaceAvailable = createSemaphore(bufferSize);

  const bus: Bus = {
    async *run(): AsyncGenerator<BusEvent> {
      while (true) {

        await itemsAvailable.acquire();
        const event = buffer[head];
        head = (head + 1) % bufferSize;
        spaceAvailable.release();

        if (event) {
          yield* await processEvent(event);
        }
      }
    },

    enqueue(event: BusEvent): void {
      lock.acquire().then((releaseLock) => {
        return spaceAvailable.acquire() // Wait for space availability
          .then(() => {
            event.timeStamp = new Date();
            buffer[tail] = event;
            tail = (tail + 1) % bufferSize;
            itemsAvailable.release(); // Signal that an item is available
          })
          .finally(() => releaseLock());
      });
    },
  };

  async function* processEvent(event: BusEvent): AsyncGenerator<BusEvent> {
    switch (event.type) {
      case 'start': {
        yield* await triggerHooks(event.target, 'start', event);
        break;
      }
      case 'finalize': {
        yield* await triggerHooks(event.target, 'finalize', event);
        break;
      }
      case 'emission': {
        yield* await triggerHooks(event.target, 'emission', event);
        if (event.payload?.emission?.pending) {
          trackPendingEmission(event.target, event.payload?.emission);
        }
        break;
      }
      case 'complete': {
        yield* await triggerHooks(event.target, 'complete', event);
        if (!pendingEmissions.has(event.target)) {
          yield* await triggerHooks(event.target, 'finalize', event);
        } else {
          stopMarkers.set(event.target, event.payload);
        }
        break;
      }
      case 'error': {
        yield* await triggerHooks(event.target, 'error', event);
        break;
      }
    }
  }

  async function* triggerHooks(target: Subscribable, hookName: string, event: BusEvent): AsyncGenerator<BusEvent> {
    if (!target) {
      console.warn(`Hook "${hookName}" not found on target.`);
      return;
    }

    yield event;

    const results = (await target.emitter.emit(hookName, event.payload)).filter((fn: any) => typeof fn === 'function');
    for (const result of results) {
      yield* await processEvent(result());
    }
  }

  function trackPendingEmission(target: any, emission: Emission) {
    if (!pendingEmissions.has(target)) {
      pendingEmissions.set(target, new Set());
    }
    const pendingSet = pendingEmissions.get(target)!;
    pendingSet.add(emission);

    emission.wait().then(async () => {
      pendingSet.delete(emission);
      if (pendingSet.size === 0) {
        pendingEmissions.delete(target);
        if (stopMarkers.has(target)) {
          const payload = stopMarkers.get(target)!;
          stopMarkers.delete(target);
          eventBus.enqueue({ target, type: 'finalize', payload });
        }
      }
    });
  }

  bus.name = 'bus';
  return bus;
}
