import { createMapper, Stream, StreamMapper } from "../abstractions";
import { createSubject, Subscription } from "../streams";

export function bufferWhen<T = any>(
  closingSelector: () => Stream<any>
): StreamMapper {
  return createMapper('bufferWhen', (input: Stream<T>): Stream<T[]> => {
    const output = createSubject<T[]>();
    let currentBuffer: T[] = [];
    let activeSubscriptions: Subscription[] = [];
    let isInputCompleted = false;

    const cleanupSubscriptions = () => {
      activeSubscriptions.forEach(sub => sub.unsubscribe());
      activeSubscriptions = [];
    };

    const subscribeToClosingNotifier = () => {
      const closingNotifier = closingSelector();
      const closingSubscription = closingNotifier.subscribe({
        next: () => {
          if (currentBuffer.length > 0) {
            output.next([...currentBuffer]);
            currentBuffer = [];
          }
          // Automatically subscribe to new closing notifier
          subscribeToClosingNotifier();
        },
        error: (err) => {
          output.error(err);
          cleanupSubscriptions();
        },
        complete: () => {
          // Only complete output if input is also completed
          if (isInputCompleted) {
            if (currentBuffer.length > 0) {
              output.next([...currentBuffer]);
            }
            output.complete();
            cleanupSubscriptions();
          }
        }
      });
      activeSubscriptions.push(closingSubscription);
    };

    const inputSubscription = input.subscribe({
      next: (value) => {
        currentBuffer.push(value);
      },
      error: (err) => {
        output.error(err);
        cleanupSubscriptions();
      },
      complete: () => {
        isInputCompleted = true;
        // Check if we have an active closing notifier
        if (activeSubscriptions.length === 0) {
          if (currentBuffer.length > 0) {
            output.next([...currentBuffer]);
          }
          output.complete();
        }
      },
    });
    activeSubscriptions.push(inputSubscription);

    // Start the first closing notifier
    subscribeToClosingNotifier();

    return output;
  });
}
