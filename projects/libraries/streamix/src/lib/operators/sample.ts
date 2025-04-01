import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function sample<T = any>(period: number): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let lastValue: T | undefined;
    let intervalId: NodeJS.Timeout | null = null;

    // Async generator to handle the input stream
    const processInputStream = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          lastValue = value; // Store the latest value from the input stream
        }
        // When input completes, clean up the interval and complete the output
        if (intervalId) clearInterval(intervalId);
        output.complete();
      } catch (err) {
        output.error(err); // Propagate any error
      }
    };

    // Start the sampling interval
    const startSampling = () => {
      intervalId = setInterval(() => {
        if (lastValue !== undefined) {
          output.next(lastValue); // Emit the last value at each interval
        }
      }, period);
    };

    // Run the input stream processing and start sampling
    (async () => {
      startSampling();
      await processInputStream();
    })();

    return output;
  };

  return createMapper('sample', operator);
}
