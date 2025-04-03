import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function audit<T = any>(duration: number): StreamMapper {
  const operator = (input: Stream<T>): Stream<T> => {
    const output = createSubject<T>();
    let lastValue: T | undefined = undefined;
    let timerActive = false; // Tracks if the timer is active
    let inputCompleted = false; // Tracks if the input stream is complete

    const emitValue = () => {
      if (lastValue !== undefined && timerActive) {
        output.next(lastValue);
        lastValue = undefined;
      }
    };

    const startAuditTimer = () => {
      timerActive = true;

      setTimeout(() => {
        emitValue();
        timerActive = false;

        // Complete output if input has completed and timer finishes
        if (inputCompleted) {
          output.complete();
        }
      }, duration);
    };

    (async () => {
      try {
        for await (const value of eachValueFrom(input)) {
          lastValue = value; // Update the latest value

          if (!timerActive) {
            startAuditTimer(); // Start the audit timer
          }
        }

        inputCompleted = true;
        lastValue = undefined;
        // Only complete if no timer is running
        if (!timerActive) {
          output.complete();
        }
      } catch (err) {
        output.error(err); // Propagate errors
      }
    })();

    return output;
  };

  return createMapper('audit', operator);
}
