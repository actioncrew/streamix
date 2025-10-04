import { createOperator, Operator, Stream } from "../abstractions";
import { eachValueFrom, fromAny } from '../converters';
import { createSubject } from "../subjects";

/**
 * Creates a stream operator that delays the emission of values from the source stream
 * until a separate `notifier` stream emits at least one value.
 *
 * This operator acts as a gate. It buffers all values from the source stream
 * until the `notifier` stream emits its first value. Once the notifier emits,
 * the operator immediately flushes all buffered values and then passes through
 * all subsequent values from the source without delay.
 *
 * If the `notifier` stream completes without ever emitting a value, this operator
 * will eventually flush all buffered values and then pass through subsequent values.
 *
 * @template T The type of the values in the source and output streams.
 * @param notifier The stream that acts as a gatekeeper.
 * @returns An `Operator` instance that can be used in a stream's `pipe` method.
 */
export function delayUntil<T = any, R = T>(notifier: Stream<R> | Promise<R>) {
  return createOperator<T, T>("delayUntil", function (this: Operator, source: AsyncIterator<T>) {
    const output = createSubject<T>();
    let canEmit = false;
    const buffer: T[] = [];

    const notifierSubscription = fromAny(notifier).subscribe({
      next: () => {
        canEmit = true;
        // flush buffered values
        for (const v of buffer) output.next(v);
        buffer.length = 0;
        notifierSubscription.unsubscribe();
      },
      error: (err) => {
        notifierSubscription.unsubscribe();
        output.error(err);
        output.complete();
      },
      complete: () => {
        notifierSubscription.unsubscribe();
        if (!canEmit) {
          canEmit = true;
          for (const v of buffer) output.next(v);
          buffer.length = 0;
        }
      },
    });

    (async () => {
      try {
        while (true) {
          const { done, value } = await source.next();
          if (done) break;

          if (canEmit) {
            output.next(value);
          } else {
            buffer.push(value);
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        // flush buffer if notifier never triggered
        if (!canEmit && buffer.length > 0) {
          for (const v of buffer) output.next(v);
        }
        output.complete();
        notifierSubscription.unsubscribe();
      }
    })();

    return eachValueFrom(output)[Symbol.asyncIterator]();
  });
}