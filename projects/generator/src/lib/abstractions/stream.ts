import { createSubject } from "../streams/subject";
import { createLock } from "../utils";
import { createEmission, Emission } from "./emission";
import { AsyncOperator, Operator, StreamOperator } from "./operator";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  emissionCounter: number;

  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: (Operator | AsyncOperator | StreamOperator)[]) => Stream<T>;
  value: () => T | undefined;
  completed: () => boolean;
};

export function createStream<T = any>(
  name: string,
  generatorFn: (this: Stream<T>) => AsyncGenerator<Emission<T>, void, unknown>
): Stream<T> {
  let emissionCounter = 0;
  let running = false;
  let completed = false;
  let currentValue: T | undefined;

  async function* generator() {
    for await (const emission of generatorFn.call(stream)) {
      emissionCounter++;
      currentValue = emission.value;
      yield emission;
    }
  }

  const chain = function (this: Stream, ...operators: (Operator | AsyncOperator)[]): Stream {
    const output = createSubject();
    let isCompleteCalled = false;
    let emissionCaptured = 0;
    let emissionProcessed = 0;
    let lock = createLock();
    let lastEmission: Emission | null = null;

    const handleComplete = () => {
      if (!isCompleteCalled) {
        isCompleteCalled = true;
        if (lastEmission && !lastEmission.error) {
          output.next(lastEmission.value);
        }
        output.complete();
        subscription.unsubscribe();
      }
    };

    const subscription = this.subscribe({
      next: (value: any) => {
        emissionCaptured++;
        let emission = createEmission({ value });
        lastEmission = emission;

        // Synchronously apply operators (but async ones still handle promises internally)
        for (const operator of operators) {
          try {
            if (
              operator.handle instanceof Function &&
              operator.handle.constructor.name === 'AsyncFunction'
            ) {
              lock.acquire().then((releaseLock) => {
                const result = operator.handle(emission, this) as any;

                if (result && typeof result.then === 'function') {
                  result
                    .then((emission: any) => {
                      lastEmission = emission;
                    })
                    .finally(() => {
                      emissionProcessed++;
                      if (emissionCaptured === emissionProcessed) {
                        handleComplete();
                      }
                      releaseLock(); // Ensure the lock is released here
                    });
                } else {
                  releaseLock();
                }
              });
            } else {
              emission = operator.handle(emission, this) as Emission;
              if (!emission.error) {
                lastEmission = emission;
              }
              emissionProcessed++;
            }
          } catch (error) {
            emission.error = error;
            break;
          }
        }
      },
      complete: () => {
        lock.acquire().then((releaseLock) => {
          if (emissionCaptured === emissionProcessed) {
            handleComplete();
          }
          releaseLock();
        });
      },
    });

    return output;
  };


  const pipe = function(this: Stream, ...steps: (Operator | AsyncOperator | StreamOperator)[]): Stream {
    let combinedStream: Stream = this;
    let operatorsGroup: (Operator | AsyncOperator)[] = [];

    for (const step of steps) {
      if ('handle' in step) {
        operatorsGroup.push(step);
      } else if (typeof step === 'function') {
        if (operatorsGroup.length > 0) {
          combinedStream = chain.call(combinedStream, ...operatorsGroup);
          operatorsGroup = [];
        }

        combinedStream = step(combinedStream);
      } else {
        throw new Error("Invalid step provided to pipe.");
      }
    }

    if (operatorsGroup.length > 0) {
      combinedStream = chain.call(combinedStream, ...operatorsGroup);
    }

    return combinedStream;
  };

  const subscribe = (
    callbackOrReceiver?: ((value: T) => void) | Receiver<T>
  ): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const iter = generator();

    running = true;

    const unsubscribe = async () => {
      if (running && !completed) {
        completed = true;
      }
    };

    (async () => {
      try {
        for await (const emission of iter) {
          receiver.next?.(emission.value!);
        }
        receiver.complete?.();
      } catch (err: any) {
        receiver.error?.(err);
      } finally {
        completed = true;
      }
    })();

    return createSubscription(() => currentValue, unsubscribe);
  };

  const stream: Stream<T> = {
    type: "stream",
    name,
    emissionCounter,
    subscribe,
    pipe,
    value: () => currentValue,
    completed: () => completed
  };

  return stream;
}
