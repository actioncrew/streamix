import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createReplaySubject, ReplaySubject } from '../streams';

export function shareReplay<T = any>(bufferSize: number = Infinity) {
  let isConnected = false;
  let sharedSubject: ReplaySubject<T> | undefined;

  return createOperator<T>('shareReplay', (source) => {
    if (!sharedSubject) {
      sharedSubject = createReplaySubject<T>(bufferSize);
    }

    if (!isConnected) {
      isConnected = true;

      (async () => {
        try {
          let result = await source.next();
          while (!result.done) {
            sharedSubject.next(result.value);
            result = await source.next();
          }
        } catch (err) {
          sharedSubject.error(err);
        } finally {
          sharedSubject.complete();
        }
      })();
    }

    return eachValueFrom(sharedSubject);
  });
}
