import { CallbackReturnType, createOperator, createStreamResult, Operator, Stream, StreamContext, StreamResult, Subscription } from "../abstractions";
import { eachValueFrom, fromAny } from '../converters';
import { createSubject } from "../streams";

/**
 * Creates a stream operator that maps each value from the source stream to a new inner stream
 * and "switches" to emitting values from the most recent inner stream, canceling the previous one.
 *
 * For each value from the source:
 * 1. The `project` function is called with the value and its index.
 * 2. The returned value is normalized into a stream using {@link fromAny}.
 * 3. The operator subscribes to the new inner stream and immediately cancels any previous active inner stream.
 * 4. Only values from the latest inner stream are emitted.
 *
 * This operator is useful for scenarios such as:
 * - Type-ahead search where only the latest query results are relevant.
 * - Handling user events where new events invalidate previous operations.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the inner and output streams.
 * @param project A function that maps a source value and its index to either:
 *   - a {@link Stream<R>},
 *   - a {@link CallbackReturnType<R>} (value or promise),
 *   - or an array of `R`.
 * @returns An {@link Operator} instance suitable for use in a stream's `pipe` method.
 */
export function switchMap<T = any, R = any>(
  project: (value: T, index: number) => Stream<R> | CallbackReturnType<R> | Array<R>
) {
  return createOperator<T, R>("switchMap", function (this: Operator, source, context) {
    const output = createSubject<R>();

    let currentSubscription: Subscription | null = null;
    let currentInnerSc: StreamContext | undefined;

    let inputCompleted = false;
    let currentInnerStreamId = 0;
    let index = 0;
    let innerHadEmissions = false;
    let pendingPhantom: StreamResult | null = null;

    const checkComplete = () => {
      if (inputCompleted && !currentSubscription) {
        output.complete();
      }
    };

    const subscribeToInner = async (innerStream: Stream<R>, streamId: number) => {
      // Cancel previous inner stream
      if (currentSubscription) {
        if (!innerHadEmissions && pendingPhantom) {
          await currentInnerSc?.markPhantom(this, pendingPhantom);
        }

        currentSubscription.unsubscribe();
        currentSubscription = null;

        // Unregister old stream
        if (currentInnerSc) {
          context?.pipeline.unregisterStream(currentInnerSc.streamId);
          currentInnerSc = undefined;
        }
      }

      innerHadEmissions = false;
      pendingPhantom = null;

      // Register new inner stream
      currentInnerSc = context?.pipeline.registerStream(innerStream);

      currentSubscription = innerStream.subscribe({
        next: (value) => {
          if (streamId === currentInnerStreamId) {
            innerHadEmissions = true;
            output.next(value);
            currentInnerSc?.logFlow("emitted", this, value, "Inner stream emitted");
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

            // Unregister on completion
            if (currentInnerSc) {
              context?.pipeline.unregisterStream(currentInnerSc.streamId);
              currentInnerSc = undefined;
            }

            checkComplete();
          }
        },
      });
    };

    (async () => {
      try {
        while (true) {
          const result = createStreamResult(await source.next());

          if (result.done) break;

          // Track outer value in case inner stream emits nothing
          pendingPhantom = result;

          const streamId = ++currentInnerStreamId;
          const innerStream = fromAny(project(result.value, index++));

          // Log outer emission
          context?.logFlow("emitted", this, result.value, "Outer value received");

          await subscribeToInner(innerStream, streamId);
        }

        inputCompleted = true;
        checkComplete();
      } catch (err) {
        output.error(err);
      }
    })();

    return eachValueFrom<R>(output);
  });
}
