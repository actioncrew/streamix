import { createOperator, createStreamResult, DONE, NEXT, Operator, StreamResult } from "../abstractions";

/**
 * Creates a stream operator that counts the number of items emitted by the source stream.
 *
 * This operator consumes all values from the source stream without emitting anything.
 * Once the source stream completes, it emits a single value, which is the total
 * number of items that were in the source stream. It then completes.
 *
 * @template T The type of the values in the source stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const count = <T = any>() =>
  createOperator<T, number>("count", function(this: Operator, source) {
    let counted = false;
    let total = 0;

    return {
      async next(): Promise<StreamResult> {
        if (counted) return DONE;

        while (true) {
          const result = createStreamResult(await source.next());
          if (result.done) break;

          total++;
        }

        counted = true;
        return NEXT(total);
      },
    };
  });
