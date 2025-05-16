import { createOperator } from "../abstractions";
import { createReplaySubject } from "../streams";

export const shareReplay = <T>(bufferSize = Infinity) =>
  createOperator<T>('shareReplay', (source) => {
    const subject = createReplaySubject<T>(bufferSize);
    const sourceIterator = source[Symbol.asyncIterator]?.() ?? source;

    let upstreamStarted = false;
    let upstreamDone = false;
    let upstreamError: any = null;

    // Start upstream pumping only once
    const ensureUpstream = () => {
      if (upstreamStarted) return;
      upstreamStarted = true;
      (async () => {
        try {
          for await (const value of sourceIterator) {
            subject.next(value);
          }
          subject.complete();
          upstreamDone = true;
        } catch (err) {
          upstreamError = err;
          subject.error?.(err);
        }
      })();
    };

    return {
      async next(): Promise<IteratorResult<T>> {
        ensureUpstream();

        const iterator = subject[Symbol.asyncIterator]();
        const result = await iterator.next();

        if (upstreamError) throw upstreamError;
        return result;
      }
    };
  });
