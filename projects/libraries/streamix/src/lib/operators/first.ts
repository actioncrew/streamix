import { CallbackReturnType, COMPLETE, createOperator, NEXT, StreamResult } from "../abstractions";

/**
 * Creates a stream operator that emits only the first element from the source stream
 * that matches an optional predicate.
 *
 * This operator is designed to find a specific value and then immediately terminate.
 * - If a `predicate` function is provided, the operator will emit the first value for which
 * the predicate returns a truthy value.
 * - If no predicate is provided, it will simply emit the very first value from the source.
 *
 * After emitting a single value, the operator completes. If the source stream completes
 * before a matching value is found, an error is thrown.
 *
 * @template T The type of the values in the source stream.
 * @param predicate An optional function to test each value. It receives the value
 * and should return `true` to indicate a match.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 * @throws {Error} Throws an error with the message "No elements in sequence" if no matching
 * value is found before the source stream completes.
 */
export const first = <T = any>(predicate?: (value: T) => CallbackReturnType<boolean>) =>
  createOperator<T, T>('first', (source, context) => {
    let found = false;
    let firstValue: T | undefined;
    let sourceDone = false;

    async function next(): Promise<StreamResult<T>> {
      if (found) {
        return COMPLETE;
      }

      if (sourceDone) {
        throw new Error("No elements in sequence");
      }

      while (!found) {
        const result = await source.next();
        if (result.done) {
          sourceDone = true;
          throw new Error("No elements in sequence");
        }

        if (result.phantom) { context.phantomHandler(result.value); continue; }

        const value = result.value;
        if (!predicate || await predicate(value)) {
          found = true;
          firstValue = value;
          return NEXT(firstValue!);
        }
      }

      return COMPLETE;
    }

    return { next };
  });
