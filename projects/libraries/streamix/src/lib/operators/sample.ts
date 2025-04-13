import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject, Subject } from "../streams";

export function sample<T = any>(period: number): StreamMapper {
  const operator = (input: Stream<T>, output: Subject<T>) => {
    let lastValue: T | undefined;
    let intervalId: any = null;

    // Async generator to handle the input stream
    const processInputStream = async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          lastValue = value; // Store the latest value from the input stream
        }
        // When input completes, emit the last value if available
        if (lastValue !== undefined) {
          output.next(lastValue);
        }
        output.complete(); // Complete the output stream when input is finished
      } catch (err) {
        output.error(err); // Propagate any error
      } finally {
        if (intervalId) clearInterval(intervalId); // Clean up interval when done
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
  };

  return createMapper('sample', createSubject<T>(), operator);
}
