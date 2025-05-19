import { eachValueFrom } from '@actioncrew/streamix';
import { createOperator, Stream } from "../abstractions";

export const withLatestFrom = <T, R extends any[]>(
  ...streams: Stream<any>[]
) =>
  createOperator('withLatestFrom', (source) => {
    const latestValues: any[] = new Array(streams.length).fill(undefined);
    const hasValue: boolean[] = new Array(streams.length).fill(false);
    const completions: boolean[] = new Array(streams.length).fill(false);
    const streamIterators = streams.map(s => eachValueFrom(s));

    // Prime the other streams — always running in background
    streams.forEach((_, i) => {
      (async () => {
        try {
          for await (const value of streamIterators[i]) {
            latestValues[i] = value;
            hasValue[i] = true;
          }
        } catch (_: any) {
          // Optional: Could propagate error
        } finally {
          completions[i] = true;
        }
      })();
    });

    return {
      async next(): Promise<IteratorResult<[T, ...R]>> {
        while (true) {
          const { value, done } = await source.next();
          if (done) return { done: true, value: undefined };

          // Wait until all latest values are present
          if (!hasValue.every(Boolean)) continue;

          return {
            done: false,
            value: [value, ...latestValues] as [T, ...R],
          };
        }
      },
    };
  });
