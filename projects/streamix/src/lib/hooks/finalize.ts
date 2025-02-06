import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams';

export const finalize = (callback: () => void | Promise<void>): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    const output = createSubject();

    const subscription = stream.subscribe({
      next: (value: any) => {
        output.next(value);
      },
      complete: async () => {
        try {
          await callback();
        } catch (error) {
          output.error(error);
        } finally {
          output.complete();
          subscription.unsubscribe();
        }
      },
      error: (err: any) => {
        output.error(err);
        subscription.unsubscribe();
      },
    });

    return output;
  };

  return createStreamOperator('finalize', operator);
};
