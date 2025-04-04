import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function delayUntil<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let isInputDone = false;
    let pendingValue: T | undefined;
    let shouldEmit = false;

    const processInput = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          pendingValue = value;
        }
        isInputDone = true;
        if (shouldEmit && pendingValue !== undefined) {
          output.next(pendingValue);
        }
        if (shouldEmit) {
          output.complete();
        }
      } catch (err) {
        output.error(err);
      }
    };

    const processNotifier = async () => {
      try {
        for await (const _ of eachValueFrom(notifier)) {
          if (pendingValue !== undefined) {
            output.next(pendingValue);
            pendingValue = undefined;
          }
        }
        shouldEmit = true;
        if (isInputDone && pendingValue !== undefined) {
          output.next(pendingValue);
          output.complete();
        } else if (isInputDone) {
          output.complete();
        }
      } catch (err) {
        output.error(err);
      }
    };

    (async () => {
      await Promise.all([processInput(), processNotifier()]);
    })();

    return output;
  };

  return createMapper('delayUntil', operator);
}
