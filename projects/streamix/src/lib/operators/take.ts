import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams/subject";

export function take<T>(count: number): StreamOperator {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let emittedCount = 0;

    const subscription = input.subscribe({
      next: (value) => {
        if (emittedCount < count) {
          emittedCount++;
          output.next(value);

          if (emittedCount === count) {
            output.complete();
            subscription.unsubscribe(); // Unsubscribe to prevent further emissions
          }
        }
      },
      error: (err) => output.error(err),
      complete: () => output.complete(),
    });

    return output;
  };

  return createStreamOperator("take", operator);
}
