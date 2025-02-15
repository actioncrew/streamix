import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams";

export type Group<T = any, K = any> = {
  values: T[];
  key: K;
};

export function groupBy<T = any, K = any>(
  keySelector: (value: T) => K
): StreamOperator<T, Group<T, K>> {
  const operator = (input: Stream<T>): Stream<Group<T, K>> => {
    const output = createSubject<Group<T, K>>(); // Output stream of grouped objects
    const groups = new Map<K, Group<T, K>>(); // Store groups as objects

    const subscription = input.subscribe({
      next: (value) => {
        const key = keySelector(value);

        // Retrieve or create the group
        let group = groups.get(key);
        if (!group) {
          group = { key, values: [] };
          groups.set(key, group);
        }

        // Add the value to its group
        group.values.push(value);
        output.next(group); // Emit group object containing `key` and `values`
      },
      error: (err: any) => output.error(err),
      complete: () => {
        output.complete();
        groups.clear();
        subscription.unsubscribe();
      },
    });

    return output;
  };

  return createStreamOperator('groupBy', operator);
}
