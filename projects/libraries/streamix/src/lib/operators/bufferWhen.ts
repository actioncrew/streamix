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
      closingSubscription = null; // Ensure a new closer starts only after emission
    };

    const setupNewCloser = () => {
      if (closingSubscription) return; // Prevent multiple subscriptions
      closingSubscription = closingSelector().subscribe({
        next: () => {
          flushBuffer();
          setupNewCloser(); // Start a new closer only after emission
        },
        error: (err) => output.error(err),
      });
    };

    const inputSubscription = input.subscribe({
      next: (value) => {
        buffer.push(value);
        setupNewCloser();
      },
      complete: () => {
        isInputComplete = true;
        flushBuffer();
        output.complete();
      },
      error: (err) => output.error(err),
    });

    return output;
  });
}
