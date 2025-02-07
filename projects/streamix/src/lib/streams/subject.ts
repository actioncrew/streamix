import { createReceiver, createSubscription, Operator, pipeStream, Receiver, Stream, StreamOperator, Subscription } from "../abstractions";

export type Subject<T = any> = Stream<T> & {
  next(value: T): void;
  complete(): void;
  error(err: any): void;  // Added error method
};

// Subject Stream Implementation
export function createSubject<T = any>(): Subject<T> {
  let subscribers: Receiver<T>[] = [];
  let latestValue: T | undefined;
  let completed = false; // Flag to indicate if the stream is completed
  let hasError = false; // Flag to indicate if an error has occurred
  let errorValue: any = null; // Store the error value

  // Emit a new value to all subscribers
  const next = (value: T) => {
    if (completed || hasError) return; // Prevent emitting if the stream is completed or in error state
    latestValue = value;
    subscribers.forEach((subscriber) => subscriber.next?.(value));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed);
  };

  // Complete the stream
  const complete = () => {
    if (completed) return; // If already completed or in error state, do nothing
    completed = true;
    subscribers.forEach((subscriber) => subscriber.complete?.());
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed); // Clean up
  };

  // Emit an error to all subscribers
  const error = (err: any) => {
    if (completed || hasError) return; // Prevent emitting errors if the stream is completed or in error state
    hasError = true;
    errorValue = err;
    subscribers.forEach((subscriber) => subscriber.error?.(err));
    subscribers = subscribers.filter((subscriber) => !subscriber.unsubscribed); // Clean up
  };

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    subscribers.push(receiver);

    if (latestValue !== undefined && !hasError) {
      receiver.next?.(latestValue); // Emit the current value to new subscriber immediately
    }

    if (hasError) {
      receiver.error?.(errorValue); // If the stream has errored, emit the error immediately
    }

    if (completed) {
      subscribers.forEach((subscriber) => subscriber.complete?.()); // If completed, notify the subscriber
    }

    return createSubscription(() => latestValue, () => {
      if (!receiver.unsubscribed) {
        receiver.unsubscribed = true;
        if (!completed) {
          completed = true;
          // Ensure that even unsubscribed receivers are notified of completion or error
          subscribers.forEach((subscriber) => subscriber.complete?.());
        }
        subscribers = subscribers.filter((sub) => sub !== receiver); // Clean up
      }
    });
  };

  const stream: Subject<T> = {
    type: "subject",
    name: "subject",
    emissionCounter: 0,
    subscribe,
    pipe: (...steps: (Operator | StreamOperator)[]) => pipeStream(stream, ...steps),
    value: () => latestValue,
    next, // Add next method
    complete, // Add complete
    completed: () => completed,
    error, // Add error method
  };

  return stream;
}
