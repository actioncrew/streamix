import { createMapper, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export function bufferWhen<T = any>(
  closingSelector: () => Stream<any>
): StreamMapper {
  return createMapper('bufferWhen', (input: Stream<T>): Stream<T[]> => {
    const output = createSubject<T[]>();
    let buffer: T[] = [];
    let closingSubscription: Subscription | null = null;
    let isInputComplete = false;

    const flushBuffer = () => {
      if (buffer.length > 0) {
        output.next(buffer);
        buffer = [];
      }
      if (!isInputComplete) {
        setupNewCloser();
      } else if (buffer.length === 0 && closingSubscription?.completed()) {
        output.complete();
      }
    };

    const setupNewCloser = () => {
      closingSubscription?.unsubscribe();
      const closer = closingSelector();
      closingSubscription = closer.subscribe({
        next: flushBuffer,
        complete: () => {
          // Don't complete output here, wait for input completion
        },
        error: (err) => output.error(err)
      });
    };

    const inputSubscription = input.subscribe({
      next: (value) => buffer.push(value),
      complete: () => {
        isInputComplete = true;
        flushBuffer();
        if (!closingSubscription || closingSubscription.completed()) {
          output.complete();
        }
      },
      error: (err) => output.error(err)
    });

    setupNewCloser(); // Initial setup

    return output;
  });
}
