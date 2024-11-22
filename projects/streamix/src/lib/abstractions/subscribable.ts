import { Operator, Pipeline, Subscription } from '../abstractions';
import { Hook } from '../utils';


export interface Subscribable<T = any> {
  type: "stream" | "chunk" | "pipeline";

  isAutoComplete: boolean;
  isStopRequested: boolean;

  isStopped: boolean;
  isRunning: boolean;

  onStart: Hook;
  onComplete: Hook;
  onStop: Hook;
  onError: Hook;
  onEmission: Hook;

  emissionCounter: number;

  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
  complete(): Promise<void>;

  subscribe(callback?: (value: T) => any): Subscription;

  pipe(...operators: Operator[]): Pipeline<T>;

  value: T | undefined;
}
