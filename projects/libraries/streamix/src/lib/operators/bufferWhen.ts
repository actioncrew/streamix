import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function bufferWhen<T = any>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>): Stream<T[]> => {
    const output = createSubject<T[]>();
    let currentBuffer: T[] = [];
    let notifierActive = false;

    const processNotifier = async () => {
      try {
        for await (const _ of eachValueFrom(notifier)) {
          if (currentBuffer.length > 0) {
            output.next([...currentBuffer]);
            currentBuffer = [];
          }
          notifierActive = true;
        }
        // Notifier completed - emit any remaining buffer
        if (currentBuffer.length > 0) {
          output.next([...currentBuffer]);
        }
        output.complete();
      } catch (err) {
        output.error(err);
      }
    };

    const processInput = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          if (notifierActive) {
            currentBuffer.push(value);
          }
        }
        // Input completed - notifier will handle completion
      } catch (err) {
        output.error(err);
      }
    };

    // Start both processors
    (async () => {
      await Promise.all([processNotifier(), processInput()]);
    })();

    return output;
  };

  return createMapper('bufferWhen', operator);
}
