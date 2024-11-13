import { Operator, Pipeline, Subscription } from '../abstractions';
import { HookType } from '../utils';


export interface Subscribable<T = any> {
  type: "stream" | "chunk" | "pipeline";

  isAutoComplete: boolean;
  isStopRequested: boolean;

  isStopped: boolean;
  isRunning: boolean;

  onStart: HookType;
  onComplete: HookType;
  onStop: HookType;
  onError: HookType;
  onEmission: HookType;

  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
  complete(): Promise<void>;

  subscribe(callback?: (value: T) => any): Subscription;

  pipe(...operators: Operator[]): Pipeline<T>;

  value: T | undefined;
}
