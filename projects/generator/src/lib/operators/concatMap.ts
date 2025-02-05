import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams";

// The concatMap operator
export function concatMap(
  project: (value: any) => Stream
): StreamOperator {
  const operator = (input: Stream) => {
    const output = createSubject(); // The subject that will emit the results
    let isProcessing = false; // Flag to track if we are processing the current stream

    const processNext = async (value: any) => {
      if (isProcessing) return; // If already processing, skip until it's done
      isProcessing = true; // Mark processing as started

      // Project the current value to a new stream
      const projectedStream = project(value);
      let completed = false;

      // Subscribe to the projected stream and handle emissions
      projectedStream.subscribe({
        next: (value: any) => {
          output.next(value); // Emit values from the projected stream
        },
        complete: () => {
          completed = true;
          if (completed) {
            isProcessing = false; // Mark the current processing as finished
          }
        },
        error: (err) => {
          output.error?.(err); // Forward any errors
        },
      });
    };

    // Subscribe to the input stream and process each emitted value
    input.subscribe({
      next: (value: any) => {
        processNext(value); // Process each value emitted from the input stream
      },
      complete: () => {
        output.complete(); // Complete the output subject when the source stream completes
      },
      error: (err) => {
        output.error?.(err); // Forward any errors from the source stream
      },
    });

    return output as Stream; // Return the output stream
  };

  return createStreamOperator('concatMap', operator);
}
