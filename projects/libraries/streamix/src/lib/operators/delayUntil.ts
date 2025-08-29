import { createOperator, createStreamResult, NEXT, Operator, Stream } from "../abstractions";
import { eachValueFrom } from '../converters';

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

export const delayUntil = <T = any>(notifier: Stream<any>) =>
  createOperator<T, T>("delayUntil", function(this: Operator, source, context) {
    let canEmit = false;
    let notifierDone = false;
    let notifierStarted = false;
    const buffer: T[] = [];

    const waitForNotifier = async () => {
      if (notifierStarted) return;
      notifierStarted = true;
      try {
        for await (const _ of eachValueFrom(notifier)) {
          void _;
          canEmit = true;
          break;
        }
      } catch {
        // ignore errors, just unblock
      } finally {
        notifierDone = true;
      }
    };

    waitForNotifier();

    return {
      next: async () => {
        while (true) {
          if (canEmit) {
            if (buffer.length) {
              const value = buffer.shift()!;
              return NEXT(value);
            }

            // CORRECT: source.next() already returns StreamResult
            const result = await source.next();

            // Log emission if context available
            context?.logFlow?.('emitted', this, result.value, 'Value emitted after delay');

            return result;
          }

          // CORRECT: source.next() already returns StreamResult
          const result = await source.next();
          if (result.done) return result;

          // Create pending result for buffered value
          if (context) {
            const pendingResult = createStreamResult({
              value: result.value,
              done: false
            });
            context.markPending(this, pendingResult);
          }

          buffer.push(result.value);

          if (notifierDone) {
            // fallback in case notifier ends without emitting
            canEmit = true;

            // Resolve all pending results when we start emitting
            if (context) {
              buffer.forEach(value => {
                const resolvedResult = createStreamResult({
                  value: value,
                  done: false
                });
                context.resolvePending(this, resolvedResult);
              });
            }
          }
        }
      },
    };
  });
