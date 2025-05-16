import { createOperator } from "../abstractions";

export type RecurseOptions = {
  traversal?: 'depth' | 'breadth';
  maxDepth?: number;
};

export const recurse = <T = any>(
  condition: (value: T) => boolean,
  project: (value: T) => AsyncIterable<T>,
  options: RecurseOptions = {}
) =>
  createOperator('recurse', (source) => {
    type QueueItem = { value: T; depth: number };
    const queue: QueueItem[] = [];
    let sourceDone = false;

    // Async iterator for the source
    const sourceIterator = source[Symbol.asyncIterator]?.() ?? source;

    // Helper to enqueue children respecting traversal strategy
    const enqueueChildren = async (value: T, depth: number) => {
      if (options.maxDepth !== undefined && depth > options.maxDepth) {
        return;
      }
      if (condition(value)) {
        for await (const child of project(value)) {
          if (options.traversal === 'breadth') {
            queue.push({ value: child, depth: depth + 1 });
          } else {
            queue.unshift({ value: child, depth: depth + 1 });
          }
        }
      }
    };

    return {
      async next(): Promise<IteratorResult<T>> {
        // If queue is empty, pull from source
        while (queue.length === 0 && !sourceDone) {
          const outerResult = await sourceIterator.next();
          if (outerResult.done) {
            sourceDone = true;
            break;
          }
          queue.push({ value: outerResult.value, depth: 0 });
        }

        if (queue.length === 0 && sourceDone) {
          // Done emitting everything
          return { value: undefined, done: true };
        }

        // Dequeue next item according to traversal order (breadth: FIFO, depth: LIFO)
        const item = options.traversal === 'breadth' ? queue.shift()! : queue.pop()!;

        // Enqueue children asynchronously but don't block emitting this item
        // We'll await enqueueChildren next time next() is called to simplify flow
        await enqueueChildren(item.value, item.depth);

        // Emit current value
        return { value: item.value, done: false };
      }
    };
  });
