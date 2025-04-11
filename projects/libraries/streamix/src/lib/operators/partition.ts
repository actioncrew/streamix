import { createMapper, Stream } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";
import { GroupItem } from "./groupBy";

export function partition<T = any>(
  predicate: (value: T, index: number) => boolean
) {
  const operator = (input: Stream<T>): Stream<GroupItem> => {
    const subject = createSubject<GroupItem>();
    let index = 0;

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (predicate(value, index++)) {
            subject.next({ key: "true", value });
          } else {
            subject.next({ key: "false", value });
          }
        }
      } catch (err) {
        subject.error(err);
      } finally {
        subject.complete();
      }
    })();

    return subject;
  };

  return createMapper('partition', operator);
}
