import { Emission, Operator, Subscription } from '../abstractions';
import { HookType, PromisifiedType } from '../utils';

export interface Subscribable<T = any> {
  isAutoComplete: PromisifiedType<boolean>;
  isCancelled: PromisifiedType<boolean>;
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

  start(context: any): void;
  run(): Promise<void>;

  shouldTerminate(): boolean;
  awaitTermination(): Promise<void>;
  terminate(): Promise<void>;

  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
  complete(): Promise<void>;

  subscribe(callback?: (value: T) => any): Subscription;

  pipe(...operators: Operator[]): Subscribable<T>;

  emit({ emission, source }: { emission: Emission; source: any }): Promise<void>;
}
