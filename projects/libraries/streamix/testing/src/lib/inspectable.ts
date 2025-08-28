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
  const sc = pipelineContext.currentStreamContext();

  function createInspectableStream<S>(
    upstream: Stream<any>,
    operators: Operator<any, any>[],
    parentContext: PipelineContext
  ): InspectableStream<S> {
    const upstreamSc = createStreamContext(parentContext, upstream);

    // Create the piped stream object first
    const pipedStream: InspectableStream<S> = {
      name: `${upstream.name}-sink`,
      type: "stream",
      context: parentContext,

      pipe<U>(...nextOps: Operator<any, any>[]): InspectableStream<U> {
        return createInspectableStream<U>(pipedStream, nextOps, parentContext);
      },

      subscribe(cb?: any): Subscription {
        const receiver = createReceiver(cb);
        const sourceIterator: StreamIterator<any> = eachValueFrom(upstream)[Symbol.asyncIterator]();

        // Create a logging wrapper for the source iterator
        const loggingSourceIterator = {
          async next() {
            const result = await sourceIterator.next();
            if (!result.done) {
              // Log source values in upstream context
              upstreamSc?.logFlow('emitted', null as any, result.value, 'Emitted source value');
            }
            return result;
          },
          return: sourceIterator.return?.bind(sourceIterator),
          throw: sourceIterator.throw?.bind(sourceIterator),
          [Symbol.asyncIterator]() { return this; }
        };

        let iterator: StreamIterator<any> = loggingSourceIterator;

        // Apply operators to create the sink iterator
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

              // Log sink values in sink context (values after transformation)
              sinkSc?.logFlow('resolved', null as any, result.value, 'Emitted sink value');

              await receiver.next?.(result.value);
            }
          } catch (err: any) {
            sinkSc?.logFlow('error', null as any, undefined, String(err));
            await receiver.error?.(err);
          } finally {
            await receiver.complete?.();
            await upstreamSc?.finalize();
            await sinkSc?.finalize();
          }
        })();

        return createSubscription(async () => {
          abortController.abort();
          if (sourceIterator.return) {
            await sourceIterator.return().catch(() => {});
          }
        });
      },

      async query() {
        return firstValueFrom(pipedStream);
      },
    };

    // Now create the sink StreamContext with the pipedStream object
    const sinkSc = createStreamContext(parentContext, pipedStream);

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

            // For the root stream (no operators), this logs the source values
            sc?.logFlow('resolved', null as any, result.value, 'Emitted source value');

            await receiver.next?.(result.value);
          }
        } catch (err: any) {
          sc?.logFlow('error', null as any, undefined, String(err));
          await receiver.error?.(err);
        } finally {
          await receiver.complete?.();
          await sc?.finalize();
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
