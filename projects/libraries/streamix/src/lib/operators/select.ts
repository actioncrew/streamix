import { createOperator } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

/**
 * Emits only the values at the specified indexes from the source stream.
 */
export const select = <T = any>(
  indexIterator: Iterator<number> | AsyncIterator<number>
) =>
  createOperator<T, T>("select", (source) => {
    function toAsyncIterator(
      iter: Iterator<number> | AsyncIterator<number>
    ): AsyncIterableIterator<number> {
      if (typeof (iter as any)[Symbol.asyncIterator] === "function") {
        return iter as AsyncIterableIterator<number>;
      }

      const syncIter = iter as Iterator<number>;

      return {
        async next() {
          return syncIter.next();
        },
        [Symbol.asyncIterator]() {
          return this;
        }
      };
    }

    const asyncIndexIterator = toAsyncIterator(indexIterator);

    const subject = createSubject<T>();

    // Feed source into subject
    (async () => {
      try {
        while (true) {
          const result = await source.next();
          if (result.done) break;
          subject.next(result.value);
        }
        subject.complete();
      } catch (err) {
        subject.error(err);
      }
    })();

    // Yield only the values at the selected indexes
    async function* selectByIndex() {
      let currentIndex = 0;
      let { value: nextTargetIndex, done: indexDone } = await asyncIndexIterator.next();

      if (indexDone) return;

      for await (const value of eachValueFrom<T>(subject)) {
        if (currentIndex === nextTargetIndex) {
          yield value;

          const next = await asyncIndexIterator.next();
          nextTargetIndex = next.value;
          indexDone = next.done;

          if (indexDone) return;
        }

        currentIndex++;
      }
    }

    return selectByIndex();
  });
