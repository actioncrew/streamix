import { createLock, createSemaphore } from '../utils';
import { createEmission, Emission } from './emission';
import { flags, hooks } from './subscribable';

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
  enqueue(event: BusEvent): Promise<void>;
  name?: string;
};

export function createBus(config?: { bufferSize?: number }): Bus {
  const bufferSize = config?.bufferSize || 64;
  const buffer: Array<BusEvent | null> = new Array(bufferSize).fill(null);

  const pendingEmissions = new Map<any, Set<Emission>>();
  const markers = new Map<any, { type: 'finalize' | 'complete'; payload: any }>();

  let head = 0;
  let tail = 0;

  const lock = createLock();
  const itemsAvailable = createSemaphore(0);
  const spaceAvailable = createSemaphore(bufferSize);
  const postponedEvents: BusEvent[] = [];

  const bus: Bus = {
    async *run(): AsyncGenerator<BusEvent> {
      while (true) {
        if (postponedEvents.length > 0) {
          yield* processEvent(postponedEvents.shift()!);
          continue;
        }

        await itemsAvailable.acquire();
        const event = buffer[head];
        buffer[head] = null;
        head = (head + 1) % bufferSize;
        spaceAvailable.release();

        if (event) {
          yield* processEvent(event);
        }
      }
    },

    async enqueue(event: BusEvent): Promise<void> {
      const releaseLock = await lock.acquire();
      try {
        await spaceAvailable.acquire();
        event.timeStamp = new Date();
        buffer[tail] = event;
        tail = (tail + 1) % bufferSize;
        itemsAvailable.release();
      } finally {
        releaseLock();
      }
    },
  };

  async function* processEvent(event: BusEvent): AsyncGenerator<BusEvent> {
    switch (event.type) {
      case 'start': {
        yield* triggerHooks(event.target, 'onStart', event);
        break;
      }
      case 'finalize': {
        if (!pendingEmissions.has(event.target)) {
          yield* triggerHooks(event.target, 'finalize', event);
        } else {
          event.target[flags].isPending = true;
          markers.set(event.target, { type: 'finalize', payload: event.payload });
        }
        break;
      }
      case 'emission': {
        yield event;

        let emission = event.payload?.emission ?? createEmission({});
        const target = event.target;

        const emissionEvents = (await target[hooks].onEmission.parallel(event.payload)).filter((fn: any) => fn instanceof Function);
        if (emission.failed) {
          yield* await processEvent({ target: event.target, payload: { error: emission.error }, type: 'error' });
        }
        else
        {
          for (const emissionEvent of emissionEvents) {
            yield* await processEvent(emissionEvent());
          }
        }

        if (emission.pending) {
          trackPendingEmission(target, emission);
        }
        break;
      }
      case 'complete': {
        if (!pendingEmissions.has(event.target)) {
          yield* triggerHooks(event.target, 'onComplete', event);
        } else {
          event.target[flags].isPending = true;
          markers.set(event.target, { type: 'complete', payload: event.payload });
        }
        break;
      }
      case 'error': {
        yield* triggerHooks(event.target, 'onError', event);
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
      yield* processEvent(result());
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
        if (markers.has(target)) {
          const { type, payload } = markers.get(target)!;
          markers.delete(target);
          eventBus.enqueue({ target, type, payload });
        }
        target[flags].isPending = false;
      }
    });
  }

  bus.name = 'bus';
  return bus;
}
