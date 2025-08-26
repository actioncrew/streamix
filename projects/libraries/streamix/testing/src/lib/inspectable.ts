import {
  createPipelineContext,
  createReceiver,
  createStreamContext,
  createSubscription,
  eachValueFrom,
  firstValueFrom,
  Operator,
  patchOperator,
  Stream,
  StreamIterator,
  Subscription,
} from "../../../src/lib";

// Operator and other types from previous files are assumed to be available.

export interface InspectableStream<T = any> extends Stream<T> {
  // A stream with a pipe method that returns another inspectable stream
  pipe<S>(...operators: Operator<T, S>[]): InspectableStream<S>;
}

/**
 * Decorates a stream to be inspectable. All piped streams get a proper
 * PipelineContext and StreamContext. All subscriptions are wrapped in an
 * InspectableSubscription.
 */
export function inspectable<T>(stream: Stream<T>): InspectableStream<T> {
  const context = createPipelineContext();
  context && createStreamContext(context, stream);

  const decorated: InspectableStream<T> = {
    ...stream,

    pipe<S>(...operators: Operator<any, any>[]): InspectableStream<S> {
      const pipedStream: InspectableStream<S> = {
        name: `${stream.name}-sink`,
        type: 'stream',

        pipe(...nextOps: Operator<any, any>[]): InspectableStream<any> {
          return decorated.pipe(...operators, ...nextOps);
        },

        subscribe(cb?: any): Subscription {
          const receiver = createReceiver(cb);

          let currentIterator: StreamIterator<any> = eachValueFrom(stream)[Symbol.asyncIterator]();

          for (const op of operators) {
            const patchedOp = patchOperator(op);
            currentIterator = patchedOp.apply(currentIterator, context);
          }

          const abortController = new AbortController();
          const { signal } = abortController;

          const abortPromise = new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            else signal.addEventListener("abort", () => resolve(), { once: true });
          });

          (async () => {
            try {
              while (true) {
                const winner = await Promise.race([
                  abortPromise.then(() => ({ aborted: true } as const)),
                  currentIterator.next().then(result => ({ result })),
                ]);

                if ("aborted" in winner || signal.aborted) break;
                const result = winner.result;
                if (result.done) break;

                await receiver.next?.(result.value);
              }
            } catch (err: any) {
              if (!signal.aborted) await receiver.error?.(err);
            } finally {
              await receiver.complete?.();
            }
          })();

          return createSubscription(async () => {
            abortController.abort();
            if (currentIterator.return) {
              await currentIterator.return().catch(() => {});
            }
          });
        },

        async query() {
          return firstValueFrom(pipedStream);
        },
      };

      return pipedStream;
    },

    subscribe(cb?: any): Subscription {
      return stream.subscribe(cb);
    },

    query(): Promise<T> {
      return firstValueFrom(stream);
    },
  };

  return decorated;
}
