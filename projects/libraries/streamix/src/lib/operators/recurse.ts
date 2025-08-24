import { CallbackReturnType, createOperator, createStreamResult, DONE, NEXT, Operator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

/**
 * Options to configure the recursive traversal behavior.
 */
export type RecurseOptions = {
  /**
   * The traversal strategy to use.
   * - `'depth'`: Processes deeper values first (LIFO queue).
   * - `'breadth'`: Processes values level by level (FIFO queue).
   * Defaults to depth-first.
   */
  traversal?: 'depth' | 'breadth';
  /**
   * The maximum depth to traverse. Prevents infinite recursion and limits the size
   * of the traversal. Defaults to no limit.
   */
  maxDepth?: number;
};

/**
 * Creates a stream operator that recursively processes values from a source stream.
 *
 * This operator is designed for traversing tree-like or hierarchical data structures.
 * For each value from the source, it checks if it meets a `condition`. If it does,
 * it applies a `project` function to get a new "inner" stream of children. These
 * children are then added to an internal queue and processed in the same recursive manner.
 *
 * The operator supports both depth-first and breadth-first traversal strategies and
 * can be configured with a maximum recursion depth to prevent runaway processing.
 *
 * @template T The type of the values in the source and output streams.
 * @param condition A function that returns a boolean indicating whether to recurse on a value.
 * @param project A function that takes a value and returns a stream of new values to be
 * recursively processed.
 * @param options An optional configuration object for traversal behavior.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export const recurse = <T = any>(
  condition: (value: T) => CallbackReturnType<boolean>,
  project: (value: T) => Stream<T>,
  options: RecurseOptions = {}
) =>
  createOperator<T, T>('recurse', function (this: Operator, source) {
    type QueueItem = { value: T; depth: number };
    const queue: QueueItem[] = [];
    let sourceDone = false;

    const enqueueChildren = async (value: T, depth: number) => {
      if (options.maxDepth !== undefined && depth >= options.maxDepth) return;
      if (!await condition(value)) return;

      for await (const child of eachValueFrom(project(value))) {
        const item = { value: child, depth: depth + 1 };
        if (options.traversal === 'breadth') {
          queue.push(item);
        } else {
          queue.unshift(item);
        }
      }
    };

    return {
      next: async () => {
        while (true) {
          // Refill queue from source if it's empty
          while (queue.length === 0 && !sourceDone) {
            const result = createStreamResult(await source.next());
            if (result.done) {
              sourceDone = true;
              break;
            }

            queue.push({ value: result.value, depth: 0 });
          }

          // If the queue now has items, process them
          if (queue.length > 0) {
            const item =
              options.traversal === 'breadth' ? queue.shift()! : queue.pop()!;
            await enqueueChildren(item.value, item.depth);
            return NEXT(item.value);
          }

          // If queue is empty and source is done, we're done
          if (sourceDone && queue.length === 0) {
            return DONE;
          }

          // Yield control briefly (avoid busy waiting)
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      },
    };
  });
