import { createStreamOperator, Stream, StreamOperator } from "../abstractions";
import { createSubject } from "../streams/subject";

// Define the catchError operator
export const catchError = (handler: (error: any) => void): StreamOperator => {
  const operator = (inputStream: Stream<any>): Stream<any> => {
    const output = createSubject<any>();

    inputStream.subscribe({
      next: (value) => {
        output.next(value);
      },
      error: (error) => {
        // When an error occurs, we pass it to the handler
        handler(error);
        // Optionally, you could return a new stream or just complete the stream
        output.complete();
      },
      complete: () => {
        output.complete();
      }
    });

    return output;
  };

  return createStreamOperator('catchError', operator);
};
