import { createTransformer, Stream, Transformer } from "../abstractions";
import { createSubject } from "../streams/subject";

// Define the catchError operator
export const catchError = (handler: ((error: any) => void) = () => {}): Transformer => {
  const operator = (inputStream: Stream<any>): Stream<any> => {
    const output = createSubject<any>();

    const subscription = inputStream.subscribe({
      next: (value) => {
        output.next(value);
      },
      error: (error) => {
        // When an error occurs, we pass it to the handler
        handler(error);
        // Optionally, you could return a new stream or just complete the stream
        output.complete();
        subscription.unsubscribe();
      },
      complete: () => {
        output.complete();
        subscription.unsubscribe();
      }
    });

    return output;
  };

  return createTransformer('catchError', operator);
};
