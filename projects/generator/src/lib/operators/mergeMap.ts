import { createStreamOperator, Stream, StreamOperator, Subscription } from "../abstractions";
import { createSubject } from "../streams/subject";

export function mergeMap<T, R>(
  project: (value: T) => Stream<R>
): StreamOperator {
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();
    let isOuterComplete = false;
    let activeSubscriptions: Subscription[] = [];

    const subscribeToInner = (innerStream: Stream<R>) => {
      const innerSub = innerStream.subscribe({
        next: (value) => output.next(value),
        error: (err) => {
          output.error(err);
          activeSubscriptions = activeSubscriptions.filter(
            (sub) => sub !== innerSub
          );
          checkComplete();
        },
        complete: () => {
          activeSubscriptions = activeSubscriptions.filter(
            (sub) => sub !== innerSub
          );
          checkComplete();
        },
      });
      activeSubscriptions.push(innerSub);
    };

    const checkComplete = () => {
      if (isOuterComplete && activeSubscriptions.length === 0) {
        output.complete();
      }
    };

    input.subscribe({
      next: (value) => {
        const innerStream = project(value);
        subscribeToInner(innerStream);
      },
      error: (err) => output.error(err),
      complete: () => {
        isOuterComplete = true;
        checkComplete();
      },
    });

    return output;
  };

  return createStreamOperator('mergeMap', operator);
}
