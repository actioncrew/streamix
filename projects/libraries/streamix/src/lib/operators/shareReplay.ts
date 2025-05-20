import { createOperator } from '../abstractions';
import { eachValueFrom } from '../converters';
import { createReplaySubject } from '../streams';

export function shareReplay<T>(bufferSize: number = Infinity) {
  let isConnected = false;
  const sharedSubject = createReplaySubject<T>(bufferSize);

  return createOperator<T>('shareReplay', (source) => {
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
