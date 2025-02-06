import { createStreamOperator, Stream, StreamOperator, Subscription } from "../abstractions";
import { createSubject } from "../streams/subject";

export function switchMap<T, R>(project: (value: T) => Stream<R>): StreamOperator {
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>(); // The output stream
    let currentSubscription: Subscription | null = null;
    let isOuterComplete = false;

    const subscribeToInner = (innerStream: Stream<R>) => {
      // Unsubscribe from the previous inner subscription if any
      if (currentSubscription) {
        currentSubscription.unsubscribe();
        currentSubscription = null;
      }

      if (!innerStream.completed()) {
        // Subscribe to the new inner stream
        currentSubscription = innerStream.subscribe({
          next: (value) => {
            output.next(value); // Forward values to the outer stream
          },
          error: (err) => {
            output.error(err); // Forward errors to the outer stream
            currentSubscription = null; // Mark the subscription as null
            checkComplete(); // Check if we can complete the outer stream
          },
          complete: () => {
            currentSubscription = null; // Mark the subscription as null
            checkComplete(); // Check if we can complete the outer stream
          },
        });
      } else {
        checkComplete(); // Check if we can complete the outer stream
      }
    };

    const checkComplete = () => {
      // Complete the outer stream if the outer stream is marked complete and there are no active subscriptions
      if (isOuterComplete && !currentSubscription) {
        output.complete();
      }
    };

    // Subscribe to the outer input stream
    input.subscribe({
      next: (value) => {
        const innerStream = project(value); // Project to the inner stream
        subscribeToInner(innerStream); // Subscribe to the inner stream
      },
      error: (err) => output.error(err), // Forward errors to the outer stream
      complete: () => {
        isOuterComplete = true; // Mark the outer stream as complete
        checkComplete(); // Check if we can complete the outer stream
      },
    });

    return output; // Return the resulting stream
  };

  return createStreamOperator("switchMap", operator); // Return the switchMap operator
}
