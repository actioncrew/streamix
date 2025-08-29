import { CallbackReturnType, createOperator, createStreamResult, Operator, Stream, StreamContext } from "../abstractions";
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

    let index = 0;
    let outerCompleted = false;
    let errorOccurred = false;
    let currentInnerCompleted = true;
    let pendingValues: T[] = [];

    const processNextInner = async () => {
      if (pendingValues.length === 0 || !currentInnerCompleted) return;

      currentInnerCompleted = false;
      const outerValue = pendingValues.shift()!;

      let innerSc: StreamContext | undefined;

      try {
        const innerStream = fromAny(project(outerValue, index++));
        innerSc = context?.pipeline.registerStream(innerStream);
        let innerHadEmissions = false;

        for await (const val of eachValueFrom(innerStream)) {
          let result = createStreamResult({ value: val });
          if (errorOccurred) break;

          output.next(result.value);
          innerHadEmissions = true;

          innerSc?.logFlow("emitted", this, val, "Inner stream emitted");
        }

        if (!innerHadEmissions && !errorOccurred && innerSc) {
          const phantomResult = createStreamResult({
            value: outerValue,
            type: 'phantom',
            done: true
          });
          innerSc.markPhantom(this, phantomResult);
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
          innerSc?.logFlow("error", this, undefined, String(err));
        }
      } finally {
        innerSc && await context?.pipeline.unregisterStream(innerSc.streamId);

        currentInnerCompleted = true;

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

          context?.logFlow("emitted", this, result.value, "Outer value received");

          if (currentInnerCompleted) {
            processNextInner();
          }
        }

        outerCompleted = true;

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
