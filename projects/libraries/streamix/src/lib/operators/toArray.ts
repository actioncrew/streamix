import { createOperator, DONE, NEXT, Operator } from "../abstractions";

/**
 * Collects all emitted values from the source stream into an array
 * and emits that array once the source completes, tracking pending state.
 *
 * @template T The type of the values in the source stream.
 * @returns An Operator instance for use in a stream's `pipe` method.
 */
export const toArray = <T = any>() =>
  createOperator<T, T[]>("toArray", function (this: Operator, source) {
    const collected: IteratorResult<T>[] = [];
    let completed = false;
    let emitted = false;

    return {
      next: async () => {
        while (true) {
          // All done and final array emitted → complete
          if (completed && emitted) {
            return DONE;
          }

          const result = await source.next();

          if (result.done) {
            completed = true;
            if (!emitted) {
              emitted = true;
              // Emit the final array of values
              return NEXT(collected.map((r) => r.value!));
            }
            continue;
          }

          collected.push(result);
        }
      },
    };
  });
