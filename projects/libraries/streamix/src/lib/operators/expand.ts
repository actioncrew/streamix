import { eachValueFrom } from '@actioncrew/streamix';
import { createMapper, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject, Subject } from "../streams";

export function expand<T = any>(
  project: (value: T) => Stream<T>,
  options: { traversal?: 'depth' | 'breadth', maxDepth?: number } = {}
): StreamMapper {
  return createMapper('expand', createSubject(), (input: Stream<T>, output: Subject<T>) => {
    let depth = 0;
    let subscription: Subscription | null = null;

    const recurseStream = async (value: T) => {
      if (options.maxDepth !== undefined && depth >= options.maxDepth) {
        output.complete(); // Stop recursion if depth limit is reached
        return;
      }

      depth++;

      try {
        const nextStream = project(value);
        for await (const nextValue of eachValueFrom(nextStream)) {
          output.next(nextValue);
          recurseStream(nextValue); // Recursively process each value
        }
      } catch (err) {
        output.error(err); // Propagate error if any
      }
    };

    subscription = input.subscribe({
      next: (value: T) => {
        recurseStream(value); // Start recursion for the first value
      },
      error: (err) => {
        output.error(err); // Pass any errors
      },
      complete: () => {
        output.complete(); // Complete when the stream is done
      },
    });

    if (subscription) {
      subscription.unsubscribe(); // Cleanup if needed
    }
  });
}
