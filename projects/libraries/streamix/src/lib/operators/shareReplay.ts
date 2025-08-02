import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createReplaySubject, ReplaySubject } from '../streams';

/**
 * Shares the source stream and replays the last `bufferSize` values to new subscribers.
 */
export function shareReplay<T = any>(bufferSize: number = Infinity) {
  let isConnected = false;
  let output: ReplaySubject<T> | undefined;

  return createOperator<T, T>('shareReplay', (source) => {
    if (!output) {
      output = createReplaySubject<T>(bufferSize);
    }

    if (!isConnected) {
      isConnected = true;

      (async () => {
        try {
          let result = await source.next();
          while (!result.done) {
            output.next(result.value);
            result = await source.next();
          }
        } catch (err) {
          output.error(err);
        } finally {
          output.complete();
        }
      })();
    }

    const iterable = eachValueFrom<T>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
