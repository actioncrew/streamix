import { Stream } from '@actioncrew/streamix';

import { CatchErrorOperator, EndWithOperator, FinalizeOperator, StartWithOperator } from '../hooks';
import { ReduceOperator } from '../operators';
import { PromisifiedType } from '../utils';
import { Emission } from './emission';
import { HookType } from './hook';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Pipeline<T = any> implements Subscribable {
  streams: Stream<T>[] = [];

  constructor(stream: Stream<T>, ...operators: Operator[]) {
    let mainStream = stream.clone(stream);
    this.streams.push(mainStream);

    let currentStream = mainStream as Stream<T>;

    for (const operator of operators) {
      if (operator instanceof Operator) {
        if (!currentStream.head) {
          currentStream.head = operator;
          currentStream.tail = operator;
        } else {
          currentStream.tail!.next = operator;
          currentStream.tail = operator;
        }

        if ('outerStream' in operator && operator.outerStream instanceof Stream) {
          currentStream = operator.outerStream;
          this.streams.push(currentStream);
        }
      }

      if (operator instanceof StartWithOperator) {
        currentStream.onStart.chain(operator.callback.bind(operator));
      } else if (operator instanceof EndWithOperator) {
        currentStream.onComplete.chain(operator.callback.bind(operator));
      } else if (operator instanceof CatchErrorOperator) {
        currentStream.onError.chain(operator.callback.bind(operator));
      } else if (operator instanceof FinalizeOperator) {
        currentStream.onStop.chain(operator.callback.bind(operator));
      } else if (operator instanceof ReduceOperator) {
        currentStream.onComplete.chain(operator.callback.bind(operator));
      }
    }
  }

  pipe(...operators: Operator[]) {
    let currentStream = this.last as Stream<T>;

    for (const operator of operators) {
      if (operator instanceof Operator) {
        if (!currentStream.head) {
          currentStream.head = operator;
          currentStream.tail = operator;
        } else {
          currentStream.tail!.next = operator;
          currentStream.tail = operator;
        }

        if ('outerStream' in operator && operator.outerStream instanceof Stream) {
          currentStream = operator.outerStream;
          this.streams.push(currentStream);
        }
      }

      if (operator instanceof StartWithOperator) {
        currentStream.onStart.chain(operator.callback.bind(operator));
      } else if (operator instanceof EndWithOperator) {
        currentStream.onComplete.chain(operator.callback.bind(operator));
      } else if (operator instanceof CatchErrorOperator) {
        currentStream.onError.chain(operator.callback.bind(operator));
      } else if (operator instanceof FinalizeOperator) {
        currentStream.onStop.chain(operator.callback.bind(operator));
      } else if (operator instanceof ReduceOperator) {
        currentStream.onComplete.chain(operator.callback.bind(operator));
      }
    }

    return this;
  }

  get head(): Operator {
    return this.first.head!;
  }
  set head(value: Operator) {
    this.first.head = value;
  }
  get tail(): Operator {
    return this.last.tail!;
  }
  set tail(value: Operator) {
    this.last.tail = value;
  }

  get isAutoComplete(): PromisifiedType<boolean> {
    return this.last.isAutoComplete;
  }
  get isCancelled(): PromisifiedType<boolean> {
    return this.last.isCancelled;
  }
  get isStopRequested(): PromisifiedType<boolean> {
    return this.last.isStopRequested;
  }
  get isFailed(): PromisifiedType<any> {
    return this.last.isFailed;
  }
  get isStopped(): PromisifiedType<boolean> {
    return this.last.isStopped;
  }
  get isUnsubscribed(): PromisifiedType<boolean> {
    return this.last.isUnsubscribed;
  }
  get isRunning(): PromisifiedType<boolean> {
    return this.last.isRunning;
  }
  get subscribers(): (void | ((value: any) => any))[] {
    return this.last.subscribers;
  }
  get onStart(): HookType {
    return this.last.onStart;
  }
  get onComplete(): HookType {
    return this.last.onComplete;
  }
  get onStop(): HookType {
    return this.last.onStop;
  }
  get onError(): HookType {
    return this.last.onError;
  }
  shouldTerminate(): boolean {
    return this.last.shouldTerminate();
  }
  awaitTermination(): Promise<void> {
    return this.last.awaitTermination();
  }
  terminate(): Promise<void> {
    return this.last.terminate();
  }
  shouldComplete(): boolean {
    return this.last.shouldComplete();
  }
  awaitCompletion(): Promise<void> {
    return this.last.awaitCompletion();
  }
  complete(): Promise<void> {
    return this.last.complete();
  }
  subscribe(callback?: (value: T) => any): Subscription {
    const subscriptions: Subscription[] = [];
    const defaultCallback = () => {};
    callback = callback ?? defaultCallback;
    // Helper function to recursively subscribe to streams
    const subscribeToStream = (stream: Subscribable<T>, callback?: (value: T) => any): Subscription => {
      const subscription = stream.subscribe(callback);
      subscriptions.push(subscription);
      return subscription;
    };

    if(this.last.subscribers.length === 0) {
      // Subscribe to streams in reverse order
      for (let i = this.streams.length - 1; i >= 0; i--) {
        subscribeToStream(this.streams[i], i === this.streams.length - 1 ? callback : defaultCallback);
      }
    } else {
      const subscription = this.last.subscribe(callback);
      subscriptions.push(subscription);
    }

    return {
      unsubscribe: () => {
        // Unsubscribe in straightforward order
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
      }
    };
  }
  emit(emission: Emission, next: Operator): Promise<void> {
    return this.first.emit(emission, next);
  }

  get first(): Subscribable<T> {
    return this.streams[0];
  }

  get last(): Subscribable<T> {
    return this.streams[this.streams.length - 1];
  }
}
