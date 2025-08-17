import { Stream } from '../abstractions';
import { recurse, RecurseOptions } from './recurse';

/**
 * Creates a stream operator that recursively expands each emitted value.
 *
 * This operator takes each value from the source stream and applies the `project`
 * function to it, which must return a new stream. It then recursively applies
 * the same logic to each value emitted by that new stream, effectively
 * flattening an infinitely deep, asynchronous data structure.
 *
 * This is particularly useful for traversing graph or tree-like data, such as
 * file directories or hierarchical API endpoints, where each item might lead
 * to a new collection of items that also need to be processed.
 *
 * @template T The type of the values in the source and output streams.
 * @param project A function that takes a value and returns a stream of new values
 * to be expanded.
 * @param options An optional configuration object for the underlying `recurse` operator.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const expand = <T = any>(
  project: (value: T) => Stream<T>,
  options: RecurseOptions = {}
) =>
  recurse<T>(
    () => true,
    project,
    options
  );
