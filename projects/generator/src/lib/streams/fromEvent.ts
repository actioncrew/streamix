import { createEmission, createStream, Stream } from "../abstractions";

// Semaphore to control event flow
class Semaphore {
  private value: number;
  private queue: ((value: void) => void)[] = [];

  constructor(initial: number = 0) {
    this.value = initial;
  }

  async acquire(): Promise<void> {
    if (this.value > 0) {
      this.value--;
      return;
    }
    return new Promise<void>(resolve => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift()!;
      resolve();
    } else {
      this.value++;
    }
  }
}

export function fromEvent<T>(target: EventTarget, event: string): Stream<T> {
  return createStream("fromEvent", async function* (this: Stream<T>) {
    const itemAvailable = new Semaphore(0); // Semaphore to signal when an event is ready to be processed
    const spaceAvailable = new Semaphore(1); // Semaphore to manage concurrent event handling

    const eventQueue: Event[] = []; // Queue to hold events
    let eventsCaptured = 0;
    let eventsProcessed = 0;

    const listener = (ev: Event) => {
      if (!this.completed()) {
        eventsCaptured++;
      }
      spaceAvailable.acquire().then(() => {
        eventQueue.push(ev); // Push event into the queue
        itemAvailable.release(); // Signal that an event is available
      });
    };

    target.addEventListener(event, listener);

    try {
      while (!this.completed() || eventsCaptured > eventsProcessed) {
        await itemAvailable.acquire(); // Wait until an event is available

        // Process and yield the event
        if (eventsCaptured > eventsProcessed) {
          const ev = eventQueue.shift()!;
          yield createEmission({ value: ev as T });
          eventsProcessed++;
          spaceAvailable.release();
        }
      }
    } finally {
      target.removeEventListener(event, listener);
    }
  });
}
