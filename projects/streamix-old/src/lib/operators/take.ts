import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams/subject";

export function take<T>(count: number): StreamOperator {
  return createStreamOperator("take", (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let emittedCount = 0;
    let isCompleted = false;

    const subscription = input({
      next: (value) => {
        if (!isCompleted && emittedCount < count) {
          emittedCount++;
          output.next(value);
          if (emittedCount === count) {
            isCompleted = true;
            output.complete();
            subscription.unsubscribe();
          }
        }
      },
      error: (err) => output.error(err),
      complete: () => {
        if (!isCompleted) {
          output.complete();
        }
      },
    });

    return output;
  });
}
