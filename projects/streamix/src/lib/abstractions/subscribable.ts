import { Emission, Operator, Subscription } from '../abstractions';
import { Hook, PromisifiedType } from '../utils';

export interface Subscribable<T = any> {
  isAutoComplete: boolean;
  isStopRequested: boolean;

  isStopped: boolean;
  isRunning: boolean;

  onStart: Hook;
  onComplete: Hook;
  onStop: Hook;
  onError: Hook;
  onEmission: Hook;

  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
  complete(): Promise<void>;

  subscribe(callback?: (value: T) => any): Subscription;

  pipe(...operators: Operator[]): Subscribable<T>;
}
