import { COMPLETE, createOperator, NEXT } from "../abstractions";
import { StreamResult } from "../abstractions/stream";

/**
 * Collects all emitted values from the source stream into an array
 * and emits that array once the source completes, tracking pending state.
 *
 * @template T The type of the values in the source stream.
 * @returns An Operator instance for use in a stream's `pipe` method.
 */
export const toArray = <T = any>() =>
  createOperator<T, T[]>("toArray", (source, context) => {
    const collected: StreamResult<T>[] = [];
    let completed = false;
    let emitted = false;

    return {
      async next(): Promise<StreamResult<T[]>> {
        while (true) {
          // All done and final array emitted → complete
          if (completed && emitted) {
            return COMPLETE;
          }

          const result = await source.next();

          if (result.done) {
            completed = true;
            if (!emitted) {
              emitted = true;
              // Resolve all pending results
              collected.forEach((r) => context.resolvePending(r));
              // Emit the final array of values
              return NEXT(collected.map((r) => r.value!));
            }
            continue;
          }

          // Mark the value as pending
          context.pendingResults.add(result);
          collected.push(result);
        }
      },
    };
  });
