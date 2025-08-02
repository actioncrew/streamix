import { CallbackReturnType, createOperator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

export type RecurseOptions = {
  traversal?: 'depth' | 'breadth';
  maxDepth?: number;
};

export const recurse = <T = any>(
  condition: (value: T) => CallbackReturnType<boolean>,
  project: (value: T) => Stream<T>,
  options: RecurseOptions = {}
) =>
  createOperator<T, T>('recurse', (source) => {
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
      async next(): Promise<IteratorResult<T>> {
        while (true) {
          // Refill queue from source if it's empty
          while (queue.length === 0 && !sourceDone) {
            const result = await source.next();
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
            return { value: item.value, done: false };
          }

          // If queue is empty and source is done, we're done
          if (sourceDone && queue.length === 0) {
            return { value: undefined, done: true };
          }

          // Yield control briefly (avoid busy waiting)
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      },
    };
  });
