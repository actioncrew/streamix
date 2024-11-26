import { Operator, Pipeline, Receiver, Subscription } from '../abstractions';
import { Hook } from '../utils';


export interface Subscribable<T = any> {
  type: "stream" | "pipeline" | "subject";

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

  awaitStart(): Promise<void>;

  shouldComplete(): boolean;
  awaitCompletion(): Promise<void>;
  complete(): Promise<void>;

  subscribe(callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription;

  pipe(...operators: Operator[]): Pipeline<T>;

  value: T | undefined;
}
