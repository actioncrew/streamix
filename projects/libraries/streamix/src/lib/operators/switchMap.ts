import { createMapper, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export function switchMap<T, R>(project: (value: T, index: number) => Stream<R>): StreamMapper {
  let index = 0;
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>(); // The output stream
    let currentSubscription: Subscription | null = null;
    let isOuterComplete = false;
    let currentInnerStreamId = 0; // Track the active inner stream ID

    const subscribeToInner = (innerStream: Stream<R>, streamId: number) => {
      // Unsubscribe from the previous inner subscription if any
      if (currentSubscription) {
        currentSubscription.unsubscribe();
        currentSubscription = null;
      }

      // Subscribe to the new inner stream
      currentSubscription = innerStream.subscribe({
        next: (value) => {
          // Only forward values from the most recent stream
          if (streamId === currentInnerStreamId) {
            output.next(value);
          }
        },
        error: (err) => {
          if (streamId === currentInnerStreamId) {
            output.error(err); // Forward errors to the outer stream
          }
        },
        complete: () => {
          if (streamId === currentInnerStreamId) {
            currentSubscription = null; // Clear the subscription
            checkComplete(); // Check if we can complete the outer stream
          }
        },
      });
    };

    const checkComplete = () => {
      // Complete the outer stream if the outer stream is marked complete and there is no active inner stream
      if (isOuterComplete && !currentSubscription) {
        output.complete();
      }
    };

    // Subscribe to the outer input stream
    input.subscribe({
      next: (value) => {
        const streamId = ++currentInnerStreamId; // Assign a unique ID to the new inner stream
        const innerStream = project(value, index++); // Project to the inner stream
        subscribeToInner(innerStream, streamId); // Subscribe to the inner stream
      },
      error: (err) => output.error(err), // Forward errors to the outer stream
      complete: () => {
        isOuterComplete = true; // Mark the outer stream as complete
        checkComplete(); // Check if we can complete the outer stream
      },
    });

    return output; // Return the resulting stream
  };

  return createMapper("switchMap", operator); // Return the switchMap operator
}
