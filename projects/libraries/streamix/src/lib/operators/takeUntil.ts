import { createMapper, Stream, StreamMapper } from "../abstractions";
import { createSubject } from "../streams";

export function takeUntil<T>(notifier: Stream<any>): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let notifierEmitted = false;

    // Async generator to handle both input stream and notifier stream in a race condition
    const processStreams = async () => {
      const inputIterator = input[Symbol.asyncIterator]();
      const notifierIterator = notifier[Symbol.asyncIterator]();

      try {
        while (true) {
          // Create promises for both the input and notifier streams
          const nextInput = inputIterator.next();
          const nextNotifier = notifierIterator.next();

          // Race between the input stream and notifier stream, and capture both results
          const raceResult = await Promise.race([
            nextNotifier.then(result => ({ 'notifier': { result } })),
            nextInput.then(result => ({ 'input': { result } }))
          ]);

          if ('notifier' in raceResult) {
            if (!notifierEmitted) {
              notifierEmitted = true;
              output.complete(); // Complete the output stream when the notifier emits
            }
            return; // Stop processing after the notifier completes
          }

          // Check if the result is from the input stream or the notifier stream
          if ('input' in raceResult) {
            const { result } = raceResult.input;
            if (!result.done) {
              output.next(result.value); // Emit value from input stream
            } else {
              output.complete(); // Stop if the input stream is done
              return;
            }
          }
        }
      } catch (err) {
        output.error(err); // Propagate any error from input or notifier streams
      }
    };

    // Start processing both streams concurrently
    processStreams();

    return output;
  };

  return createMapper('takeUntil', operator);
}
