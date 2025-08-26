import {
  createPipelineContext,
  createReceiver,
  createStreamContext,
  createSubscription,
  eachValueFrom,
  firstValueFrom,
  Operator,
  patchOperator,
  PipelineContext,
  Stream,
  StreamIterator,
  Subscription,
} from "../../../src/lib";

export interface InspectableStream<T = any> extends Stream<T> {
  pipe<S>(...operators: Operator<T, S>[]): InspectableStream<S>;
  readonly context?: PipelineContext;
}

/**
 * Wraps a stream to make it "inspectable".
 */
export function inspectable<T>(source: Stream<T>): InspectableStream<T> {
  const rootContext = createPipelineContext();
  if (rootContext) {
    createStreamContext(rootContext, source);
  }

  // Helper function to safely get current stream context
  function getSafeStreamContext(context?: PipelineContext) {
    if (!context) return undefined;

    // Check if the context has the method you expect
    if (typeof (context as any).currentStreamContext === 'function') {
      return (context as any).currentStreamContext();
    }

    // Alternative: check if there's a different way to get stream context
    if (typeof (context as any).getCurrentStream === 'function') {
      return (context as any).getCurrentStream();
    }

    // Or check if context itself has stream information
    if ((context as any).stream) {
      return (context as any).stream;
    }

    return undefined;
  }

  function createInspectableStream<S>(
    upstream: Stream<any>,
    operators: Operator<any, any>[],
    parentContext?: PipelineContext
  ): InspectableStream<S> {
    const context = parentContext ?? createPipelineContext();
    if (context) {
      createStreamContext(context, upstream);
    }

    const pipedStream: InspectableStream<S> = {
      name: `${upstream.name}-sink`,
      type: "stream",
      context,

      pipe<U>(...nextOps: Operator<any, any>[]): InspectableStream<U> {
        return createInspectableStream<U>(pipedStream, nextOps, context);
      },

      subscribe(cb?: any): Subscription {
        const receiver = createReceiver(cb);

        // Get current stream context safely
        const streamContext = getSafeStreamContext(context);
        if (streamContext) {
          streamContext.onSubscribe?.();
        }

        let currentIterator: StreamIterator<any> =
          eachValueFrom(upstream)[Symbol.asyncIterator]();

        for (const op of operators) {
          const patchedOp = patchOperator(op);

          // Apply operator with context - check what patchOperator expects
          if (typeof patchedOp.apply === 'function') {
            currentIterator = patchedOp.apply(currentIterator, context);
          }
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
                currentIterator.next().then((result) => ({ result })),
              ]);

              if ("aborted" in winner || signal.aborted) break;
              const result = winner.result;
              if (result.done) break;

              // Notify stream context about emission
              if (streamContext) {
                streamContext.onEmit?.(result.value);
              }

              await receiver.next?.(result.value);
            }
          } catch (err: any) {
            if (!signal.aborted) {
              if (streamContext) {
                streamContext.onError?.(err);
              }
              await receiver.error?.(err);
            }
          } finally {
            if (streamContext) {
              streamContext.onComplete?.();
            }
            await receiver.complete?.();
          }
        })();

        return createSubscription(async () => {
          if (streamContext) {
            streamContext.onUnsubscribe?.();
          }
          abortController.abort();
          if (currentIterator.return) {
            await currentIterator.return().catch(() => {});
          }
        });
      },

      async query() {
        return firstValueFrom(pipedStream);
      }
    };

    return pipedStream;
  }

  // Decorate original stream
  const decorated: InspectableStream<T> = {
    ...source,
    context: rootContext,

    pipe<S>(...operators: Operator<any, any>[]): InspectableStream<S> {
      return createInspectableStream<S>(source, operators, rootContext);
    },

    subscribe(cb?: any): Subscription {
      const receiver = createReceiver(cb);
      const streamContext = getSafeStreamContext(rootContext);

      if (streamContext) {
        streamContext.onSubscribe?.();
      }

      const originalSubscription = source.subscribe({
        next: (value) => {
          if (streamContext) {
            streamContext.onEmit?.(value);
          }
          receiver.next?.(value);
        },
        error: (err) => {
          if (streamContext) {
            streamContext.onError?.(err);
          }
          receiver.error?.(err);
        },
        complete: () => {
          if (streamContext) {
            streamContext.onComplete?.();
          }
          receiver.complete?.();
        }
      });

      return createSubscription(async () => {
        if (streamContext) {
          streamContext.onUnsubscribe?.();
        }
        await originalSubscription.unsubscribe();
      });
    },

    query(): Promise<T> {
      return firstValueFrom(source);
    }
  };

  return decorated;
}
