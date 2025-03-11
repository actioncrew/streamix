import { createStreamOperator, Stream, Transformer } from "../abstractions";
import { createSubject } from "../streams";

export function takeWhile<T>(predicate: (value: T) => boolean): Transformer {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();

    (async () => {
      let isCompleted = false;

      try {
        for await (const emission of input) {
          // If predicate returns false, complete the stream
          if (!predicate(emission.value!)) {
            output.complete();
            isCompleted = true;
            break;
          }
          output.next(emission.value!);
        }
      } catch (err) {
        output.error(err);
      } finally {
        if (!isCompleted) {
          output.complete();
        }
      }
    })();

    return output;
  };

  return createStreamOperator('takeWhile', operator);
}
