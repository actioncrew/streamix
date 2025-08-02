import { createOperator, Operator, Stream } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createSubject } from '../streams';

export function mergeMap<T = any, R = any>(
  project: (value: T, index: number) => Stream<R>,
): Operator {
  return createOperator<T, R>('mergeMap', (source) => {
    const output = createSubject<R>();

    let index = 0;
    let activeInner = 0;
    let outerCompleted = false;
    let errorOccurred = false;

    // Process each inner stream concurrently
    const processInner = async (innerStream: Stream<R>) => {
      try {
        for await (const val of eachValueFrom(innerStream)) {
          if (errorOccurred) break;
          output.next(val);
        }
      } catch (err) {
        if (!errorOccurred) {
          errorOccurred = true;
          output.error(err);
        }
      } finally {
        activeInner--;
        if (outerCompleted && activeInner === 0 && !errorOccurred) {
          output.complete();
        }
      }
    };

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;
          if (errorOccurred) break;

          const inner = project(value, index++);
          activeInner++;
          processInner(inner); // concurrent, do not await
        }

        outerCompleted = true;
        if (activeInner === 0 && !errorOccurred) {
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
}
