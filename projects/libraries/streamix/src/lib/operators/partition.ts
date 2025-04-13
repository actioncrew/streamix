import { createMapper, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";
import { GroupItem } from "./groupBy";

export function partition<T = any>(
  predicate: (value: T, index: number) => boolean
) {
  const operator = (input: Stream<T>, output: Subject<GroupItem>) => {
    let index = 0;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (predicate(value, index++)) {
            output.next({ key: "true", value });
          } else {
            output.next({ key: "false", value });
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        output.complete();
      }
    })();
  };

  return createMapper('partition', createSubject<GroupItem>(), operator);
}
