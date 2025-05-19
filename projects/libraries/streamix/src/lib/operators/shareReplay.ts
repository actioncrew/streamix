import { createOperator } from "../abstractions";
import { eachValueFrom } from "../converters"; // Assuming you have this
import { createReplaySubject } from "../streams";

export const shareReplay = <T>(bufferSize = Infinity) =>
  createOperator('shareReplay', (source) => {
    const subject = createReplaySubject<T>(bufferSize);
    let upstreamStarted = false;

    // Start upstream pumping only once
    const ensureUpstream = () => {
      if (upstreamStarted) return;
      upstreamStarted = true;
      (async () => {
        try {
          while (true) {
            const result = await source.next();
            if (result.done) {
              subject.complete();
              break;
            }
            subject.next(result.value);
          }
        } catch (err) {
          subject.error?.(err);
        }
      })();
    };

    ensureUpstream(); // Start the upstream immediately

    const iterableFromSubject: AsyncIterable<T> = eachValueFrom(subject);

    return {
      [Symbol.asyncIterator]() {
        return iterableFromSubject[Symbol.asyncIterator]();
      },
      next: async (): Promise<IteratorResult<T>> => {
        return await iterableFromSubject[Symbol.asyncIterator]().next();
      }
    };
  });
