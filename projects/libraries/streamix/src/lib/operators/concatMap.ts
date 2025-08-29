import { CallbackReturnType, createOperator, createStreamResult, Operator, Stream } from "../abstractions";
import { eachValueFrom, fromAny } from "../converters";
import { createSubject, Subject } from "../streams";

/**
 * Creates a stream operator that maps each value from the source stream to a new
 * inner stream (or value/array/promise) and flattens all inner streams sequentially.
 *
 * For each value from the source:
 * 1. The `project` function is called with the value and its index.
 * 2. The returned value is normalized into a stream using {@link fromAny}.
 * 3. The inner stream is consumed fully before processing the next outer value.
 *
 * This ensures that all emitted values maintain their original sequential order.
 *
 * @template T The type of values in the source stream.
 * @template R The type of values emitted by the inner streams and the output.
 * @param project A function that takes a value from the source stream and its index,
 * and returns either:
 *   - a {@link Stream<R>},
 *   - a {@link CallbackReturnType<R>} (value or promise),
 *   - or an array of `R`.
 * @returns An {@link Operator} instance that can be used in a stream's `pipe` method.
 */
export const concatMap = <T = any, R = any>(
  project: (value: T, index: number) => Stream<R> | CallbackReturnType<R> | Array<R>
) =>
  createOperator<T, R>("concatMap", function (this: Operator, source, context) {
    const output: Subject<R> = createSubject<R>();
    const sc = context?.currentStreamContext();

    let index = 0;
    let outerCompleted = false;
    let errorOccurred = false;
    let currentInnerCompleted = true;
    let pendingValues: T[] = [];

    const processNextInner = async () => {
      if (pendingValues.length === 0 || !currentInnerCompleted) return;

      currentInnerCompleted = false;
      const outerValue = pendingValues.shift()!;

      try {
        const innerStream = fromAny(project(outerValue, index++));
        const innerSc = context?.registerStream(innerStream);
        let innerHadEmissions = false;

        for await (const val of eachValueFrom(innerStream)) {
          if (errorOccurred) break;

          output.next(val);
          innerHadEmissions = true;

          // Log with inner stream's context
          innerSc?.logFlow('emitted', null as any, val, 'Inner stream emitted');
        }

        // Log phantom for inner streams with no emissions
        if (!innerHadEmissions && !errorOccurred) {
          await innerSc?.phantomHandler(null as any, outerValue);
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      } finally {
        currentInnerCompleted = true;

        // Process next inner stream if available
        if (pendingValues.length > 0) {
          processNextInner();
        } else if (outerCompleted && pendingValues.length === 0) {
          output.complete();
        }
      }
    };

    (async () => {
      try {
        while (true) {
          const result = createStreamResult(await source.next());
          if (result.done) break;
          if (errorOccurred) break;

          pendingValues.push(result.value);

          // Log outer value reception
          sc?.logFlow('emitted', this, result.value, 'Outer value received');

          if (currentInnerCompleted) {
            processNextInner();
          }
        }

        outerCompleted = true;

        // Complete if no pending values and current inner is done
        if (pendingValues.length === 0 && currentInnerCompleted && !errorOccurred) {
          output.complete();
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      }
    })();

    return eachValueFrom<R>(output);
  });
