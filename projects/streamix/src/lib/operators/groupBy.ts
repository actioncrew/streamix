import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams/subject";

export function groupBy<T = any, K = any>(
  keySelector: (value: T) => K // Function to extract the key from each value
): StreamOperator {
  const operator = (input: Stream<T>): Stream<Stream<T>> => {
    const output = createSubject<Stream<T>>(); // Output stream of grouped streams
    const groups = new Map<K, Stream<T>>(); // Map to store groups by key

    input.subscribe({
      next: (value) => {
        const key = keySelector(value); // Get the key for the current value

        // Check if a group for this key already exists
        if (!groups.has(key)) {
          // Create a new group (stream) for this key
          const group = createSubject<T>();
          groups.set(key, group); // Store the group in the map
          output.next(group); // Emit the new group to the output stream
        }

        // Emit the value to the corresponding group
        groups.get(key)!.next(value);
      },
      error: (err) => output.error(err), // Propagate errors to the output stream
      complete: () => {
        // Complete all groups and the output stream
        groups.forEach((group) => group.complete());
        output.complete();
      },
    });

    return output;
  };

  return createStreamOperator('groupBy', operator);
}
