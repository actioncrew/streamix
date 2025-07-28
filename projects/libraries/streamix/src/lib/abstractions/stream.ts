import { eachValueFrom } from "../converters";
import { Operator } from "./operator";
import { CallbackReturnType, createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: Operator[]) => Stream<any>;
};

export function createStream<T>(
  name: string,
  generatorFn: () => AsyncGenerator<T, void, unknown>,
  isMulticast: boolean = true
): Stream<T> {
  // For multicast streams
  let activeSubscriptions: {
    receiver: Receiver<T>;
    subscription: Subscription<T>;
  }[] = [];
  let isRunning = false;
  let abortController = new AbortController();

  const subscribe = (
    callbackOrReceiver?: ((value: T) => CallbackReturnType) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = createSubscription<T>(() => {
      if (isMulticast) {
        // Find and remove this specific subscription
        const subscriptionIndex = activeSubscriptions.findIndex(
          sub => sub.subscription === subscription
        );

        if (subscriptionIndex !== -1) {
          const { receiver: cancelledReceiver } = activeSubscriptions[subscriptionIndex];
          activeSubscriptions.splice(subscriptionIndex, 1);

          // Complete the cancelled receiver
          if (cancelledReceiver.complete) {
            try {
              cancelledReceiver.complete();
            } catch (error) {
              console.warn("Error completing cancelled receiver:", error);
            }
          }
        }

        if (activeSubscriptions.length === 0) {
          abortController.abort();
          // Reset state for potential future subscriptions
          isRunning = false;
        }
      }
    });

    if (isMulticast) {
      activeSubscriptions.push({ receiver, subscription });

      if (!isRunning) {
        isRunning = true;
        // Create a new abort controller for this multicast session
        abortController = new AbortController();
        startMulticastLoop(generatorFn);
      }
    } else {
      subscription.listen(generatorFn, receiver);
    }

    return subscription;
  };

  const startMulticastLoop = async (genFn: () => AsyncGenerator<T, void, unknown>) => {
    const signal = abortController.signal;
    let currentIterator: AsyncIterator<T> | null = null;

    try {
      currentIterator = genFn()[Symbol.asyncIterator]();

      const abortPromise = new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () => reject("aborted"), { once: true });
      });

      while (activeSubscriptions.length > 0 && !signal.aborted) {
        let result: IteratorResult<T> | { aborted: true };

        try {
          result = await Promise.race([
            currentIterator.next(),
            abortPromise
          ]) as IteratorResult<T>;
        } catch (err) {
          if (err === "aborted") break;
          throw err;
        }

        if ('aborted' in result) break;
        if (result.done) break;

        const subscribers = [...activeSubscriptions];
        await Promise.all(
          subscribers.map(async ({ receiver }) => {
            try {
              if (receiver.next) {
                await receiver.next(result.value);
              }
            } catch (error) {
              console.warn("Subscriber error:", error);
            }
          })
        );
      }
    } catch (err) {
      if (!signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        const subscribers = [...activeSubscriptions];
        await Promise.all(
          subscribers.map(async ({ receiver }) => {
            try {
              if (receiver.error) {
                await receiver.error(error);
              }
            } catch {}
          })
        );
      }
    } finally {
      if (currentIterator?.return) {
        try {
          await currentIterator.return(undefined);
        } catch {}
      }

      // Only complete remaining active subscriptions (those that weren't individually cancelled)
      const subscribers = [...activeSubscriptions];
      await Promise.all(
        subscribers.map(async ({ receiver }) => {
          try {
            if (receiver.complete) {
              await receiver.complete();
            }
          } catch {}
        })
      );

      isRunning = false;
    }
  };

  const multicast = (): Stream<T> => {
    if (isMulticast) return stream;
    return createStream(name, generatorFn, true);
  };

  const stream: Stream<T> = {
    type: isMulticast ? "subject" : "stream",
    name,
    subscribe,
    pipe(...steps: Operator[]) {
      return pipeStream(this, ...steps);
    },
    multicast
  } as any;

  return stream;
}

export function pipeStream<T = any>(
  source: Stream<any>,
  ...steps: Operator<any, any>[]
): Stream<T> {
  if (!steps?.length) return source as unknown as Stream<T>;

  const sink = createStream(`sink`, async function* () {
    const baseIterator = eachValueFrom(source)[Symbol.asyncIterator]();
    const finalIterator = steps.reduce<AsyncIterator<any>>(
      (iterator, operator) => operator.apply(iterator),
      baseIterator
    );

    try {
      while (true) {
        const result = await finalIterator.next();

        if (result.done) break;
        yield result.value;
      }
    } catch (err) {
      // Forward timeout or iterator errors if needed
      throw err;
    } finally {
      if (finalIterator.return) {
        try {
          await finalIterator.return(undefined);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }, false); // Use unicast for piped streams to avoid sharing state

  return sink as unknown as Stream<T>;
}
