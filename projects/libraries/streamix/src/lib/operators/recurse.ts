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
    let processing = false;
    let inputComplete = false;

    const processQueue = async () => {
      if (processing) return;
      processing = true;

      try {
        while (queue.length > 0) {
          const { value, depth } = options.traversal === 'breadth'
            ? queue.shift()!
            : queue.pop()!;

          if (options.maxDepth !== undefined && depth > options.maxDepth) {
            continue;
          }

          output.next(value);

          if (condition(value)) {
            try {
              const childStream = project(value);
              for await (const child of eachValueFrom(childStream)) {
                if (options.traversal === 'depth') {
                  queue.push({ value: child, depth: depth + 1 });
                } else {
                  queue.push({ value: child, depth: depth + 1 });
                }
              }
            } catch (error) {
              output.error(error);
              return;
            }
          }
        }

        if (inputComplete && queue.length === 0) {
          output.complete();
        }
      } catch (err) {
        output.error(err);
      } finally {
        processing = false;

        if (queue.length > 0) {
          processQueue();
        }
      }
    };

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          queue.push({ value, depth: 0 });
          processQueue();
        }
        inputComplete = true;
        if (queue.length === 0 && !processing) {
          output.complete();
        }
      } catch (error) {
        output.error(error);
      }
    })();

    return output;
  });
}
