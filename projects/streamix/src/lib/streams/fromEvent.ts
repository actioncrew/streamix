import { createEmission, createStream, Stream } from "../abstractions";
import { createSemaphore } from "../utils";


export function fromEvent<T>(target: EventTarget, event: string): Stream<T> {
  return createStream("fromEvent", async function* (this: Stream<T>) {
    const itemAvailable = createSemaphore(0); // Semaphore to signal when an event is ready to be processed
    const spaceAvailable = createSemaphore(1); // Semaphore to manage concurrent event handling

    let buffer: Event | undefined; // Queue to hold events
    let eventsCaptured = 0;
    let eventsProcessed = 0;

    const listener = (ev: Event) => {
      if (!this.completed()) {
        eventsCaptured++;
      }
      spaceAvailable.acquire().then(() => {
        buffer = ev; // Push event into the queue
        itemAvailable.release(); // Signal that an event is available
      });
    };

    target.addEventListener(event, listener);

    try {
      while (!this.completed() || eventsCaptured > eventsProcessed) {
        await itemAvailable.acquire(); // Wait until an event is available

        // Process and yield the event
        if (eventsCaptured > eventsProcessed) {
          yield createEmission({ value: buffer as T });
          eventsProcessed++;
          spaceAvailable.release();
        }
      }
    } finally {
      target.removeEventListener(event, listener);
    }
  });
}
