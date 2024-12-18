import { Chunk, isChunk } from './chunk';
import { createLock, createSemaphore } from '../utils';
import { createEmission, Emission } from './emission';
import { flags, hooks } from './subscribable';
import { isStream, Stream } from './stream';

export const eventBus = createBus();

(async function startEventBus() {
  for await (const event of eventBus.run()) {
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
  dequeue(): Promise<BusEvent>;
  hasFutureEvents(target: any): boolean;
  canCleanSource(source: any): boolean;
  name?: string;
};

export function createBus(config?: { bufferSize?: number }): Bus {
  const bufferCapacity = config?.bufferSize || 64;
  const buffer: Array<BusEvent | null> = new Array(bufferCapacity).fill(null);

  const activeSources = new Set<Stream<any> | Chunk<any>>();
  const completedSources = new Set<Stream<any> | Chunk<any>>();

  const pendingEmissions = new Map<any, Set<Emission>>();
  const stopMarkers = new Map<any, any>();

  let head = 0;
  let tail = 0;

  const lock = createLock();
  const itemsAvailable = createSemaphore(0);
  const spaceAvailable = createSemaphore(bufferCapacity);

  const bus: Bus = {
    async *run(this: Bus): AsyncGenerator<BusEvent> {
      while (true) {
        let event = await this.dequeue();
        if (event) {
          yield* await processEvent(this, event);
        }
      }
    },

    enqueue(event: BusEvent): void {
      lock.acquire().then((releaseLock) => {
        return spaceAvailable.acquire()
          .then(() => {
            event.timeStamp = new Date();
            buffer[tail] = event;
            tail = (tail + 1) % bufferCapacity;
            itemsAvailable.release();
          })
          .finally(() => releaseLock());
      });
    },

    async dequeue(): Promise<BusEvent> {
      await itemsAvailable.acquire();
      const event = buffer[head] as BusEvent;
      head = (head + 1) % bufferCapacity;
      spaceAvailable.release();
      return event;
    },

    // Check if a target has future events
    hasFutureEvents(source: any): boolean {
      const bufferSize = (tail - head + bufferCapacity) % bufferCapacity;

      // Iterate through the buffer to check for the source
      for (let i = 0; i < bufferSize; i++) {
        const index = (head + i) % bufferSize;
        const event = buffer[index] as BusEvent;
        if (event.payload?.source === source) {
          return true;  // Found an event for the source
        }
      }

      return false;
    },

    canCleanSource(this: Bus, source: any): boolean {
      // Check if the source has no pending emissions
      const noPendingEmissions = !pendingEmissions.has(source);
      // Check if the source has no future events in the event bus
      const noFutureEvents = !this.hasFutureEvents(source);
      // Check if the source is completed
      const isCompleted = completedSources.has(source);
      return noPendingEmissions && noFutureEvents && isCompleted;
    }
  };

  async function* processEvent(bus: Bus, event: BusEvent): AsyncGenerator<BusEvent> {
    switch (event.type) {
      case 'start': {
        activeSources.add(event.target);
        yield* await triggerHooks(event.target, 'onStart', event);
        break;
      }
      case 'emission': {
        yield* await triggerHooks(event.target, 'subscribers', event);
        if (event.payload?.emission?.pending) {
          trackPendingEmission(event.target, event.payload?.emission);
        }

        const source = event.payload?.source;
        if (source && bus.canCleanSource(source)) {
          activeSources.delete(source);
          completedSources.delete(source);

          if (isStream(source)) {
            // Additional check for chunks: ensure the parent stream is also cleanable
            for (const activeSource of activeSources.values()) {
              const chunk = activeSource as unknown as Chunk;
              if (isChunk(chunk) && chunk.stream === source && !pendingEmissions.has(chunk) && !bus.hasFutureEvents(chunk)) {
                activeSources.delete(chunk);
                yield* await processEvent(bus, { target: chunk, payload: {}, type: 'complete' });
              }
            }
          }
        }

        break;
      }
      case 'complete': {
        yield* await triggerHooks(event.target, 'onComplete', event);
        completedSources.add(event.target);

        if (isChunk(event.target) && !pendingEmissions.has(event.target)) {
          yield* await triggerHooks(event.target, 'finalize', event);
        } else {
          event.target[flags].isPending = true;
          stopMarkers.set(event.target, event.payload);
        }
        break;
      }
      case 'error': {
        yield* await triggerHooks(event.target, 'onError', event);
        break;
      }
    }
  }

  async function* triggerHooks(target: any, hookName: string, event: BusEvent): AsyncGenerator<BusEvent> {
    const hook = target?.[hooks]?.[hookName];
    if (!hook) {
      console.warn(`Hook "${hookName}" not found on target.`);
      return;
    }

    yield event;

    const results = (await hook.parallel(event.payload)).filter((fn: any) => typeof fn === 'function');
    for (const result of results) {
      yield* await processEvent(bus, result());
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
        target[flags].isPending = false;
      }
    });
  }

  bus.name = 'bus';
  return bus;
}
