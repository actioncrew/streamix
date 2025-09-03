import { createOperator, createStreamResult, Operator, StreamGenerator, StreamResult } from "../abstractions";

function toStreamGenerator<T>(gen: AsyncGenerator<T>): StreamGenerator<T> {
  const iterator = gen as unknown as StreamGenerator<T>;
  iterator[Symbol.asyncIterator] = () => iterator;
  return iterator;
}

/**
 * Creates a stream operator that emits only the values at the specified indices from a source stream.
 *
 * This operator takes an `indexIterator` (which can be a synchronous or asynchronous iterator
 * of numbers) and uses it to determine which values from the source stream should be emitted.
 * It effectively acts as a filter, but one that operates on the position of the elements
 * rather than their content.
 *
 * The operator consumes the source stream and internally buffers its values. At the same time,
 * it pulls indices from the provided iterator. When the current element's index matches an index
 * from the iterator, the element is emitted. This allows for flexible and dynamic data sampling.
 *
 * @template T The type of the values in the source and output streams.
 * @param indexIterator An iterator or async iterator that provides the zero-based indices
 * of the elements to be emitted.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const select = <T = any>(
  indexIterator: Iterator<number> | AsyncIterator<number>
) =>
  createOperator<T, T>("select", function (this: Operator, source) {
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

    let currentIndex = 0;
    let nextTargetIndexPromise = asyncIndexIterator.next();

    async function* generator() {
      while (true) {
        const result: StreamResult = createStreamResult(await source.next());
        if (result.done) break;

        const nextTargetIndex = (await nextTargetIndexPromise).value;
        const indexDone = (await nextTargetIndexPromise).done;

        if (indexDone) return;

        if (currentIndex === nextTargetIndex) {
          yield result.value;

          // fetch next target index
          nextTargetIndexPromise = asyncIndexIterator.next();
        }

        currentIndex++;
      }
    }

    return toStreamGenerator(generator())[Symbol.asyncIterator]();
  });
