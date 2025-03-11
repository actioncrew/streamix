import { createStreamOperator, Stream, Transformer } from "../abstractions";
import { createSubject } from "../streams";

export function takeUntil<T>(notifier: Stream<any>): Transformer {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let notifierEmitted = false;

    // Async generator to handle the input stream with takeUntil logic
    const processInputStream = async () => {
      try {
        for await (const emission of input) {
          if (notifierEmitted) return; // Stop processing if the notifier has emitted
          output.next(emission.value!); // Forward the value from the input stream
        }
      } catch (err) {
        output.error(err); // Propagate any error
      }
    };

    // Async generator to handle the notifier stream
    const processNotifierStream = async () => {
      try {
        for await (const _ of notifier) {
          notifierEmitted = true; // Mark notifier as emitted
          output.complete(); // Complete the output stream
          break; // Stop processing further from the input stream
        }
      } catch (err) {
        output.error(err); // Propagate any error from the notifier stream
      }
    };

    // Run both input stream and notifier stream concurrently
    (async () => {
      await Promise.all([processInputStream(), processNotifierStream()]);
    })();

    return output;
  };

  return createStreamOperator('takeUntil', operator);
}
