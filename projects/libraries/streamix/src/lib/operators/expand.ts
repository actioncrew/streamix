import { createMapper, Stream, StreamMapper } from "../abstractions";
import { recurse } from "../operators";
import { createSubject, Subject } from "../streams";

export function expand<T = any>(
  project: (value: T) => Stream<T>,
  options: { traversal?: 'depth' | 'breadth', maxDepth?: number; } = {}
): StreamMapper {
  return createMapper('expand', createSubject<T>(), (input: Stream<T>, output: Subject<T>) => {
    const expanded = input.pipe(
      recurse(() => true, value => project(value), options)
    );

    // Forward from the expanded stream to the output subject
    const subscription = expanded.subscribe({
      next: value => output.next(value),
      error: err => output.error(err),
      complete: () => { subscription.unsubscribe(); output.complete(); }
    });
  });
}
