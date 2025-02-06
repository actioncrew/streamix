import { createStreamOperator, Stream, StreamOperator, Subscription } from "../abstractions";
import { createSubject } from "../streams";

export function takeWhile<T>(predicate: (value: T) => boolean): StreamOperator {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let inputSubscription: Subscription | null = null;

    // Subscribe to the input stream
    inputSubscription = input.subscribe({
      next: (value) => {
        if (predicate(value)) {
          output.next(value); // Emit the value if the predicate is true
        } else {
          output.complete(); // Complete the stream if the predicate is false
          if (inputSubscription) inputSubscription.unsubscribe();
        }
      },
      error: (err) => output.error(err),
      complete: () => output.complete(),
    });

    return output;
  };

  return createStreamOperator('takeWhile', operator);
}
