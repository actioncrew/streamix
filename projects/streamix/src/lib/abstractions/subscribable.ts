import { Emission, Operator, Subscription } from '../abstractions';
import { HookType, PromisifiedType } from '../utils';

export interface Subscribable<T = any> {
  isAutoComplete: PromisifiedType<boolean>;
  isStopRequested: PromisifiedType<boolean>;

  isStopped: PromisifiedType<boolean>;
  isRunning: boolean;

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

  subscribe(callback?: (value: T) => any): Subscription;

  pipe(...operators: Operator[]): Subscribable<T>;
}
