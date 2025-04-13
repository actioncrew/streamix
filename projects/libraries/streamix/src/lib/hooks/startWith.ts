import { createMapper, Stream, StreamMapper, Subscription } from '../abstractions';
import { createSubject, Subject } from '../streams';

export const startWith = <T = any>(startValue: T): StreamMapper<T, T> => {
  return createMapper(
    'startWith',
    createSubject<T>(),
    (input: Stream<T>, output: Subject<T>) => {
      let emittedInitial = false;
      let subscription: Subscription | null = null;

      subscription = input.subscribe({
        next: (value) => {
          if (!emittedInitial) {
            output.next(startValue);
            emittedInitial = true;
          }
          output.next(value);
        },
        error: (err) => {
          output.error(err);
        },
        complete: () => {
          if (!emittedInitial) {
            output.next(startValue);
          }
          output.complete();
        }
      });
    }
  );
};
