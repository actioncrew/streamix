import { createStreamOperator, Stream, StreamOperator, Subscription } from '../abstractions';
import { createSubject } from '../streams';

export const fork = <T = any, R = T>(
  options: Array<{ on: (value: T) => boolean; handler: () => Stream<R> }>
): StreamOperator => {
  const operator = (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();
    let isOuterComplete = false;
    let activeSubscriptions: Subscription[] = [];
    const innerQueue: Array<Stream<R>> = [];

    const subscribeToInner = (innerStream: Stream<R>) => {
      if (innerStream.completed()) {
        // If the inner stream is already completed, check if we can complete the outer stream
        if (isOuterComplete && activeSubscriptions.length === 0) {
          output.complete();
        }
        return;
      }

      const innerSub = innerStream.subscribe({
        next: (value) => output.next(value),
        error: (err) => {
          output.error(err);
          activeSubscriptions = activeSubscriptions.filter(
            (sub) => sub !== innerSub
          );
          if (innerQueue.length > 0) {
            subscribeToInner(innerQueue.shift()!);
          } else if (isOuterComplete && activeSubscriptions.length === 0) {
            output.complete();
          }
        },
        complete: () => {
          activeSubscriptions = activeSubscriptions.filter(
            (sub) => sub !== innerSub
          );
          if (innerQueue.length > 0) {
            subscribeToInner(innerQueue.shift()!);
          } else if (isOuterComplete && activeSubscriptions.length === 0) {
            output.complete();
          }
        },
      });
      activeSubscriptions.push(innerSub);
    };

    input.subscribe({
      next: (value) => {
        const matchedOption = options.find(({ on }) => on(value));
        if (matchedOption) {
          const innerStream = matchedOption.handler();
          if (activeSubscriptions.length > 0) {
            innerQueue.push(innerStream);
          } else {
            subscribeToInner(innerStream);
          }
        } else {
          output.error(new Error(`No handler found for value: ${value}`));
        }
      },
      error: (err) => output.error(err),
      complete: () => {
        isOuterComplete = true;
        if (innerQueue.length === 0 && activeSubscriptions.length === 0) {
          output.complete();
        }
      },
    });

    return output;
  };

  return createStreamOperator('fork', operator);
};
