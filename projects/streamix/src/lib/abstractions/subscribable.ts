import { PromisifiedType } from '../utils';
import { HookType } from './hook';
import { Operator } from './operator';
import { Subscription } from './subscription';

export interface Subscribable<T = any> {
  isAutoComplete:  PromisifiedType<boolean>;
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

  head: Operator | undefined;
  tail: Operator | undefined;

  shouldTerminate(): boolean;
  awaitTermination(): Promise<void>;
  terminate(): Promise<void>;

  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
  complete(): Promise<void>;

  pipe(...operators: Operator[]): Subscribable<T>;
  subscribe(callback: ((value: T) => any) | void): Subscription;
}
