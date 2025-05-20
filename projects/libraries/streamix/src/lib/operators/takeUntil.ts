import { createOperator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

export const takeUntil = (notifier: Stream<any>) =>
  createOperator("takeUntil", (source) => {
    let shouldStop = false;
    let done = false;

    // Start listening to the notifier asynchronously
    (async () => {
      try {
        for await (const _ of eachValueFrom(notifier)) {
          shouldStop = true;
          break;
        }
      } catch (_: any) {
        // If notifier errors, you might optionally choose to propagate or log
        shouldStop = true;
      }
    })();

    return {
      async next() {
        if (done || shouldStop) return { done: true, value: undefined };

        const result = await source.next();

        if (result.done || shouldStop) {
          done = true;
          return { done: true, value: undefined };
        }

        return result;
      }
    };
  });
