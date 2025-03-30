import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function recurse<T = any>(
  condition: (value: T) => boolean,
  project: (value: T) => Stream<T>,
  options: {
    traversal?: 'depth' | 'breadth';
    maxDepth?: number;
  } = {}
): StreamMapper {
  return createMapper('recurse', (input: Stream<T>) => {
    const output = createSubject<T>();
    const queue: { value: T; depth: number }[] = [];
    let activeCount = 0;

    const processNext = async () => {
      while (queue.length && (options.maxDepth === undefined || queue[0].depth <= options.maxDepth)) {
        const { value, depth } = options.traversal === 'breadth' ? queue.shift()! : queue.pop()!;
        
        output.next(value);
        if (condition(value)) {
          activeCount++;
          try {
            for await (const child of eachValueFrom(project(value))) {
              queue.push({ value: child, depth: depth + 1 });
            }
          } finally {
            activeCount--;
          }
        }
      }
      if (activeCount === 0) output.complete();
    };

    (async () => {
      for await (const value of eachValueFrom(input)) {
        queue.push({ value, depth: 0 });
        processNext();
      }
    })();

    return output;
  });
}
