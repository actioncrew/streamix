import { createMapper, Stream, StreamMapper } from "../abstractions";
import { createSubject } from "../streams";

export type GroupItem<T = any, K = any> = {
  value: T;
  key: K;
};

export function groupBy<T = any, K = any>(
  keySelector: (value: T) => K
): StreamMapper {
  const operator = (input: Stream<T>): Stream<GroupItem<T, K>> => {
    const output = createSubject<GroupItem<T, K>>();

    const subscription = input.subscribe({
      next: (value) => {
        const key = keySelector(value);
        output.next({ key, value });
      },
      error: (err: any) => output.error(err),
      complete: () => {
        output.complete();
        subscription.unsubscribe();
      },
    });

    return output;
  };

  return createMapper('groupBy', operator);
}
