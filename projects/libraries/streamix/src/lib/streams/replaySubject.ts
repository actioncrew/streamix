import { createReceiver, createSubscription, Operator, pipeStream, Receiver, StreamMapper, Subscription } from "../abstractions";
import { createBaseSubject, Subject } from "../streams";

export type ReplaySubject<T = any> = Omit<Subject<T>, "peek">;

export function createReplaySubject<T>(bufferSize: number = Infinity): ReplaySubject<T> {
  const { base, complete, error, pullValue, processPullRequests, cleanupBuffer, cleanupAfterReceiver } = createBaseSubject<T>();

  const nextWithBuffer = (value: T) => {
    if (base.completed || base.hasError) return;
    base.buffer.push(value);

    if (bufferSize !== Infinity && base.buffer.length > bufferSize) {
      base.buffer.shift();

      for (const [receiver, state] of base.subscribers.entries()) {
        if (state.startIndex > 0) {
          base.subscribers.set(receiver, {
            startIndex: state.startIndex - 1,
            endIndex: state.endIndex === Infinity ? Infinity : state.endIndex - 1,
          });
        }
      }
    }

    processPullRequests();
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    let unsubscribing = false;
    let latestValue: T | undefined;
    const replayCount = Math.min(bufferSize, base.buffer.length);
    const replayStartIndex = base.buffer.length - replayCount;

    base.subscribers.set(receiver, { startIndex: replayStartIndex, endIndex: Infinity });

    const subscription = createSubscription(
      () => {
        if (!unsubscribing) {
          unsubscribing = true;
          const subscriptionState = base.subscribers.get(receiver)!;
          subscriptionState.endIndex = base.buffer.length;
          base.subscribers.set(receiver, subscriptionState);
          base.pullRequests.delete(receiver);
          cleanupBuffer();
        }
      }
    );

    (async () => {
      try {
        while (true) {
          const subscriptionState = base.subscribers.get(receiver);
          if (!subscriptionState || subscriptionState.startIndex >= subscriptionState.endIndex) {
            break;
          }
          const result = await pullValue(receiver);
          if (result.done) break;

          latestValue = result.value;
          receiver.next(result.value);
        }
      } catch (err: any) {
        receiver.error(err);
      } finally {
        receiver.complete();
        cleanupAfterReceiver(receiver);
      }
    })();

    Object.assign(subscription, {
      value: () => latestValue
    });

    return subscription;
  };

  const subject: ReplaySubject<T> = {
    type: "subject",
    name: "replaySubject",
    subscribe,
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(subject, ...steps),
    next: nextWithBuffer,
    complete,
    completed: () => base.completed,
    error,
  };

  return subject;
}
