import {
  CallbackReturnType,
  createOperator,
  createReceiver,
  createSubscription,
  Receiver,
  Stream,
  Subscription
} from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

/**
 * Combines the source stream with the latest values from the provided streams.
 * Emits a tuple containing the latest value from the source followed by the latest values from all other streams,
 * only after all streams have emitted at least once.
 *
 * The output completes or errors if the source or any provided stream completes/errors.
 */
export function withLatestFrom<T = any, R extends readonly unknown[] = any[]>(...streams: { [K in keyof R]: Stream<R[K]> }) {
  return createOperator<T, [T, ...R]>("withLatestFrom", (source) => {
    const output = createSubject<[T, ...R]>();
    const latestValues: any[] = new Array(streams.length).fill(undefined);
    const hasValue: boolean[] = new Array(streams.length).fill(false);
    const subscriptions: Subscription[] = [];

    for (let i = 0; i < streams.length; i++) {
      const subscription = streams[i].subscribe({
        next: (value) => {
          latestValues[i] = value;
          hasValue[i] = true;
        },
        error: (err) => {
          output.error(err);
        }
      });
      subscriptions.push(subscription);
    }

    const abortController = new AbortController();
    const { signal } = abortController;

    const abortPromise = new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve();
      } else {
        signal.addEventListener("abort", () => resolve(), { once: true });
      }
    });

    const iterator = source;

    (async () => {
      try {
        while (true) {
          const winner = await Promise.race([
            abortPromise.then(() => ({ aborted: true })),
            iterator.next().then(result => ({ result }))
          ]);

          if ('aborted' in winner || signal.aborted) break;
          if (winner.result.done) break;

          if (hasValue.every(Boolean)) {
            output.next([winner.result.value, ...latestValues] as [T, ...R]);
          }
        }
      } catch (err) {
        if (!signal.aborted) {
          output.error(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        output.complete();
      }
    })();

    const originalSubscribe = output.subscribe;
    output.subscribe = (
      callbackOrReceiver?: ((value: [T, ...R]) => CallbackReturnType) | Receiver<[T, ...R]>
    ): Subscription => {
      const receiver = createReceiver(callbackOrReceiver);
      const subscription = originalSubscribe.call(output, receiver);

      return createSubscription(() => {
        abortController.abort();
        subscription.unsubscribe();
        subscriptions.forEach(sub => sub.unsubscribe());

        if (typeof iterator.return === "function") {
          iterator.return().catch(() => {});
        }
      });
    };

    const iterable = eachValueFrom<[T, ...R]>(output);
    return iterable[Symbol.asyncIterator]();
  });
}
