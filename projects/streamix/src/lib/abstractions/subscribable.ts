import { Emission, Operator, Subscription } from '../abstractions';
import { HookType, PromisifiedType } from '../utils';

export interface Subscribable<T = any> {
  currentValue: T | undefined;

  isAutoComplete: PromisifiedType<boolean>;
  isStopRequested: PromisifiedType<boolean>;

  isFailed: PromisifiedType<any>;
  isStopped: PromisifiedType<boolean>;
  isUnsubscribed: PromisifiedType<boolean>;
  isRunning: PromisifiedType<boolean>;

  subscribers: HookType;
  onStart: HookType;
  onComplete: HookType;
  onStop: HookType;
  onError: HookType;
  onEmission: HookType;

  start(): void;

  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
  complete(): Promise<void>;

  subscribe(callback?: ((value: T) => void) | void): Subscription;

  pipe(...operators: Operator[]): Subscribable<T>;
}
