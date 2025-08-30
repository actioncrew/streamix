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
  const context = createPipelineContext({
    logLevel: LogLevel.WARN,
    flowLogLevel: LogLevel.DEBUG,
    phantomHandler: (operator, streamContext, result) => {
      streamContext.logFlow('phantom', operator, result, 'Phantom value dropped');
    },
  });

  function createInspectableStream<S>(
    upstream: Stream<any>,
    operators: Operator<any, any>[]
  ): InspectableStream<S> {
    const upstreamSc = context ? createStreamContext(upstream, context) : undefined;

    // Create the piped stream object
    const pipedStream: InspectableStream<S> = {
      name: `${upstream.name}-sink`,
      type: "stream",
      context: context,

      pipe<U>(...nextOps: Operator<any, any>[]): InspectableStream<U> {
        // Combine current operators with new ones for proper chaining
        const allOperators = [...operators, ...nextOps];
        return createInspectableStream<U>(upstream, allOperators);
      },

      subscribe(cb?: any): Subscription {
        const receiver = createReceiver(cb);
        const sourceIterator: StreamIterator<any> = eachValueFrom(upstream)[Symbol.asyncIterator]();

        // Create a logging wrapper for the source iterator
        const loggingSourceIterator = {
          async next() {
            const result = await sourceIterator.next();
            if (!result.done) {
              upstreamSc?.logFlow('emitted', null as any, result.value, 'Emitted source value');
            }
            return result;
          },
          return: sourceIterator.return?.bind(sourceIterator),
          throw: sourceIterator.throw?.bind(sourceIterator),
          [Symbol.asyncIterator]() { return this; }
        };

        let iterator: StreamIterator<any> = loggingSourceIterator;

        // Apply all operators in sequence
        for (const op of operators) {
          const patched = patchOperator(op);
          iterator = patched.apply(iterator, upstreamSc);
        }

        const abortController = new AbortController();
        const { signal } = abortController;

        const abortPromise = new Promise<void>((resolve) => {
          if (signal.aborted) resolve();
          else signal.addEventListener("abort", () => resolve(), { once: true });
        });

        // Create sink context for the final stream
        const sinkSc = context ? createStreamContext(pipedStream, context) : undefined;

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

    return pipedStream;
  }

  // For the root stream with no operators yet
  const decorated: InspectableStream<T> = {
    ...source,
    context: context,

    pipe<S>(...operators: Operator<any, any>[]): InspectableStream<S> {
      return createInspectableStream<S>(source, operators);
    },

    subscribe(cb?: any): Subscription {
      const receiver = createReceiver(cb);
      let iterator: StreamIterator<T> = eachValueFrom(source)[Symbol.asyncIterator]();

      const sc = context ? createStreamContext(source, context) : undefined;

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
