import {
  createPipelineContext,
  createReceiver,
  createStreamContext,
  createSubscription,
  eachValueFrom,
  firstValueFrom,
  LogLevel,
  Operator,
  patchOperator,
  PipelineContext,
  Stream,
  StreamIterator,
  Subscription,
} from "@actioncrew/streamix";

export interface InspectableStream<T = any> extends Stream<T> {
  pipe<S>(...operators: Operator<T, S>[]): InspectableStream<S>;
  readonly context: PipelineContext;
}

/**
 * Wrap a stream to make it "inspectable".
 * All operators will receive a proper PipelineContext and StreamContext.
 */
export function inspectable<T>(source: Stream<T>): InspectableStream<T> {
  // One PipelineContext for the entire source pipeline
  const pipelineContext = createPipelineContext({
    logLevel: LogLevel.INFO,
    phantomHandler: (operator, streamContext, result) => {
      streamContext.logFlow('phantom', operator, result, 'Phantom value dropped');
    },
  });

  // Root StreamContext for the source stream itself
  const rootContext = createStreamContext(pipelineContext, source);

  function createInspectableStream<S>(
    upstream: Stream<any>,
    operators: Operator<any, any>[],
    parentContext: PipelineContext
  ): InspectableStream<S> {
    const streamContext = createStreamContext(parentContext, upstream);

    const pipedStream: InspectableStream<S> = {
      name: `${upstream.name}-sink`,
      type: "stream",
      context: parentContext,

      pipe<U>(...nextOps: Operator<any, any>[]): InspectableStream<U> {
        return createInspectableStream<U>(pipedStream, nextOps, parentContext);
      },

      subscribe(cb?: any): Subscription {
        const receiver = createReceiver(cb);
        let iterator: StreamIterator<any> = eachValueFrom(upstream)[Symbol.asyncIterator]();

        // Apply operators
        for (const op of operators) {
          const patched = patchOperator(op);
          iterator = patched.apply(iterator, parentContext);
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
                iterator.next().then(result => ({ result })),
              ]);

              if ("aborted" in winner || signal.aborted) break;

              const { result } = winner;
              if (result.done) break;

              const streamResult = streamContext.createResult({ value: result.value });
              streamContext.logFlow('resolved', null as any, streamResult, 'Emitted value');

              await receiver.next?.(result.value);
            }
          } catch (err: any) {
            streamContext.logFlow('error', null as any, undefined, String(err));
            await receiver.error?.(err);
          } finally {
            await receiver.complete?.();
            await streamContext.finalize();
          }
        })();

        return createSubscription(async () => {
          abortController.abort();
          if (iterator.return) {
            await iterator.return().catch(() => {});
          }
        });
      },

      async query() {
        return firstValueFrom(pipedStream);
      },
    };

    return pipedStream;
  }

  const decorated: InspectableStream<T> = {
    ...source,
    context: pipelineContext,

    pipe<S>(...operators: Operator<any, any>[]): InspectableStream<S> {
      return createInspectableStream<S>(source, operators, pipelineContext);
    },

    subscribe(cb?: any): Subscription {
      const receiver = createReceiver(cb);
      let iterator: StreamIterator<T> = eachValueFrom(source)[Symbol.asyncIterator]();

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
              iterator.next().then(result => ({ result })),
            ]);

            if ("aborted" in winner || signal.aborted) break;

            const { result } = winner;
            if (result.done) break;

            const streamResult = rootContext.createResult({ value: result.value });
            rootContext.logFlow('resolved', null as any, streamResult, 'Emitted value');

            await receiver.next?.(result.value);
          }
        } catch (err: any) {
          rootContext.logFlow('error', null as any, undefined, String(err));
          await receiver.error?.(err);
        } finally {
          await receiver.complete?.();
          await rootContext.finalize();
        }
      })();

      return createSubscription(async () => {
        abortController.abort();
        if (iterator.return) {
          await iterator.return().catch(() => {});
        }
      });
    },

    query(): Promise<T> {
      return firstValueFrom(source);
    },
  };

  return decorated;
}
