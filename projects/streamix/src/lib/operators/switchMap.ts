import { createStreamOperator, Stream, StreamOperator, Subscription } from "../abstractions";
import { createSubject } from "../streams/subject";

export function switchMap<T, R>(project: (value: T) => Stream<R>): StreamOperator {
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>(); // The output stream
    let currentSubscription: Subscription | null = null;
    let isOuterComplete = false;
    let activeInnerStreams = 0; // Track active inner streams

    const subscribeToInner = (innerStream: Stream<R>) => {
      // Unsubscribe from the previous inner subscription if any
      if (currentSubscription) {
        currentSubscription.unsubscribe();
        currentSubscription = null;
      }

      // Increment active inner streams count
      activeInnerStreams += 1;

      // Subscribe to the new inner stream
      currentSubscription = innerStream.subscribe({
        next: (value) => output.next(value), // Forward values to the outer stream
        error: (err) => {
          output.error(err); // Forward errors to the outer stream
          currentSubscription = null; // Mark the subscription as null
          checkComplete(); // Check if we can complete the outer stream
        },
        complete: () => {
          activeInnerStreams -= 1; // Decrement active inner streams count
          currentSubscription = null; // Mark the subscription as null
          checkComplete(); // Check if we can complete the outer stream
        },
      });
    };

    const checkComplete = () => {
      // Complete the outer stream if the outer stream is marked complete and there are no active inner streams
      if (isOuterComplete && activeInnerStreams === 0) {
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
