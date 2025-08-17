import { createOperator, Stream, Subscription } from "../abstractions";
import { eachValueFrom } from '../converters';
import { createSubject } from "../streams";

/**
 * Creates a stream operator that maps each value from the source stream to a new inner
 * stream and then "switches" to emitting from the latest inner stream, canceling the
 * previous one.
 *
 * This operator is useful for scenarios where you need to perform a side effect or
 * an asynchronous operation for each value from the source, but you only care about
 * the results from the most recent operation. When a new value arrives, any ongoing
 * operation from the previous value is immediately canceled.
 *
 * This behavior is ideal for type-ahead search, where you only want the results from
 * the latest query, or for handling user events where new events invalidate old ones.
 *
 * @template T The type of the values in the source stream.
 * @template R The type of the values in the inner and output streams.
 * @param project A function that takes a value from the source and returns a new stream.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function switchMap<T = any, R = any>(project: (value: T, index: number) => Stream<R>) {
  return createOperator<T, R>("switchMap", (source) => {
    const output = createSubject<R>();

    let currentSubscription: Subscription | null = null;
    let inputCompleted = false;
    let currentInnerStreamId = 0;
    let index = 0;

    const checkComplete = () => {
      if (inputCompleted && !currentSubscription) {
        output.complete();
      }
    };

    const subscribeToInner = (innerStream: Stream<R>, streamId: number) => {
      if (currentSubscription) {
        currentSubscription.unsubscribe();
        currentSubscription = null;
      }

      currentSubscription = innerStream.subscribe({
        next: (value) => {
          if (streamId === currentInnerStreamId) {
            output.next(value);
          }
        },
        error: (err) => {
          if (streamId === currentInnerStreamId) {
            output.error(err);
          }
        },
        complete: () => {
          if (streamId === currentInnerStreamId) {
            currentSubscription = null;
            checkComplete();
          }
        },
      });
    };

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;

          const streamId = ++currentInnerStreamId;
          const innerStream = project(value, index++);
          subscribeToInner(innerStream, streamId);
        }
        inputCompleted = true;
        checkComplete();
      } catch (err) {
        output.error(err);
      }
    })();

    const iterable = eachValueFrom<R>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
