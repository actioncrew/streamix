import { createEmission, createStream, Stream } from '../abstractions';
import { createSemaphore } from '../utils';

/**
 * Creates a Stream using `MutationObserver` to observe DOM mutations.
 *
 * @param element - The DOM element to observe.
 * @param options - Optional configuration for `MutationObserver`.
 * @returns A Stream emitting mutation records when changes occur.
 */
export function onMutation(
  element: Element,
  options?: MutationObserverInit
): Stream<MutationRecord[]> {
  return createStream<MutationRecord[]>('onMutation', async function* (this: Stream<MutationRecord[]>) {
    const itemAvailable = createSemaphore(0); // Semaphore to signal when a mutation is ready to be processed
    const spaceAvailable = createSemaphore(1); // Semaphore to manage concurrent event handling

    let buffer: MutationRecord[] | undefined; // Store mutation records
    let mutationsCaptured = 0;
    let mutationsProcessed = 0;

    const callback = (mutations: MutationRecord[]) => {
      if (mutations.length) {
        mutationsCaptured++; // Increment when new mutations are captured
        spaceAvailable.acquire().then(() => {
          buffer = [...mutations]; // Store a copy of the mutations in the buffer
          itemAvailable.release(); // Signal that the mutation is ready to be processed
        });
      }
    };

    const observer = new MutationObserver(callback);
    observer.observe(element, options);

    try {
      while (!this.completed() || mutationsCaptured > mutationsProcessed) {
        await itemAvailable.acquire(); // Wait until mutations are available

        if (mutationsCaptured > mutationsProcessed) {
          yield createEmission({ value: buffer! }); // Emit the buffered mutations
          mutationsProcessed++; // Mark the mutations as processed
          spaceAvailable.release(); // Allow space for new mutations
        }
      }
    } finally {
      observer.disconnect(); // Clean up the observer
    }
  });
}
