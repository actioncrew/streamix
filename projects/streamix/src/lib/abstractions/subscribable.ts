import { Operator, Receiver, Stream, StreamOperator, Subscription } from '../abstractions';
import { Hook } from '../utils';

export const hooks = Symbol('subscribable');
export const flags = Symbol('subscribable');
export const internals = Symbol('subscribable');
export interface Subscribable<T = any> {
  type: "stream" | "pipeline" | "subject";
  emissionCounter: number;

  subscribe(callback?: ((value: T) => any) | Receiver): Subscription;
  pipe(...steps: (Operator | StreamOperator)[]): Stream;

  complete(): Promise<void>;

  value: T | undefined;

  [flags]: SubscribableFlags;
  [internals]: SubscribableInternals;
}


export interface SubscribableHooks {
  onStart: Hook;
  onComplete: Hook;
  onError: Hook;
  onEmission: Hook;
  finalize: Hook;
  subscribers: Hook;
}

export interface SubscribableFlags {

  isAutoComplete: boolean;
  isUnsubscribed: boolean;

  isStopped: boolean;
  isRunning: boolean;
}

export interface SubscribableInternals {
  awaitStart(): Promise<void>;
  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
}
