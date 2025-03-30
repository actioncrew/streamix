import { createMapper, Stream, StreamMapper } from "../abstractions";
import { recurse } from "../operators";

export function expand<T = any>(
  project: (value: T) => Stream<T>
): StreamMapper {
  return createMapper('expand', (input: Stream<T>) => {
    return input.pipe(
      recurse(
        () => true, // Always continue recursion
        value => project(value)
      )
    );
  });
}
