import { CatchErrorOperator, EndWithOperator, FinalizeOperator, StartWithOperator } from '../hooks';
import { ReduceOperator } from '../operators';
import { promisified } from '../utils';
import { Emission } from './emission';
import { hook } from './hook';
import { Operator } from './operator';
import { Subscription } from './subscription';

export class Stream<T = any> {

  isAutoComplete = promisified<boolean>(false);
  isCancelled = promisified<boolean>(false);
  isStopRequested = promisified<boolean>(false);

  isFailed = promisified<any>(undefined);
  isStopped = promisified<boolean>(false);
  isUnsubscribed = promisified<boolean>(false);
  isRunning = promisified<boolean>(false);

  subscribers: (((value: T) => any) | void)[] = [];

  onStart = hook();
  onComplete = hook();
  onStop = hook();
  onError = hook();

  run(): Promise<void> {
    throw new Error('Method is not implemented.');
  }

  shouldTerminate() {
    return this.isCancelled() || this.isFailed();
  }

  awaitTermination() {
    return promisified.race([this.isCancelled, this.isFailed]);
  }

  terminate(): Promise<void> {
    this.isCancelled.resolve(true);
    return this.isStopped.then(() => Promise.resolve());
  }

  shouldComplete() {
    return this.isAutoComplete() || this.isUnsubscribed() || this.isStopRequested();
  }

  awaitCompletion() {
    return promisified.race([this.isAutoComplete, this.isUnsubscribed, this.isStopRequested]);
  }

  complete(): Promise<void> {
    this.isStopRequested.resolve(true);
    return this.isRunning() ? this.isStopped.then(() => Promise.resolve()) : Promise.resolve();
  }

  unsubscribe(callback: (value: T) => any): void {
    this.subscribers = this.subscribers.filter(subscriber => subscriber !== callback);
    if (this.subscribers.length === 0) {
      this.isStopRequested.resolve(true);
      this.isUnsubscribed.resolve(true);
    }
  }
  
  // Protected method to handle the unsubscribe chain
  protected unsubscribeChain(stream: Stream<T>, callback: ((value: T) => any) | void): void {
    stream.unsubscribe(callback);

    // If no more subscribers, unsubscribe from the parent
    if (stream.subscribers.length === 0 && stream.parent) {
      stream.unsubscribeChain(stream.parent, callback);
    }
  }

  // Protected method to handle the subscription chain
  protected subscribeChain(stream: Stream<T>, callback: ((value: T) => any) | void): void {
    const boundCallback = callback ?? (() => {});
    stream.subscribers.push(boundCallback);

    if (stream.subscribers.length === 1 && stream.isRunning() === false) {
      stream.isRunning.resolve(true);

      queueMicrotask(async () => {
        try {
          // Subscribe to the parent stream chain first
          if (stream.parent) {
            stream.subscribeChain(stream.parent, boundCallback);
          }

          // Emit start value if defined
          await stream.onStart?.process({ stream });

          // Start the actual stream logic without waiting for it to complete
          await stream.run();

          // Emit end value if defined
          await stream.onComplete?.process({ stream });
        } catch (error) {
          // Handle error if catchError defined
          await stream.onError?.process({ stream, error });
          if (stream.onError === undefined) {
            stream.isFailed.resolve(error);
          }
        } finally {
          // Handle finalize callback
          await stream.onStop?.process({ stream });

          stream.isStopped.resolve(true);
          stream.isRunning.reset();
        }
      });
    }
  }

  // Public method to subscribe
  subscribe(callback: ((value: T) => any) | void): Subscription {
    this.subscribeChain(this.child!, callback);

    return {
      unsubscribe: () => {
        const boundCallback = callback ?? (() => {});
        this.unsubscribeChain(this.child!, boundCallback);
      }
    };
  }

  next: Stream<T> | undefined = undefined;
  
  head: Operator | undefined = undefined;
  tail: Operator | undefined = undefined;

  pipe(...operators: Operator[]): Stream<T> {
    let self = this.clone(this);
    let currentStream = self as Stream<T>;

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
          currentStream = currentStream.combine(outerStream as Stream<T>);
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

    self.child = currentStream;
    return self;
  }

  clone(stream: Stream<T>) {
    const result = Object.create(Object.getPrototypeOf(stream));
    Object.assign(result, stream);

    result.isAutoComplete = promisified<boolean>(false);
    result.isCancelled = promisified<boolean>(false);
    result.isStopRequested = promisified<boolean>(false);

    result.isFailed = promisified<any>(undefined);
    result.isStopped = promisified<boolean>(false);
    result.isUnsubscribed = promisified<boolean>(false);
    result.isRunning = promisified<boolean>(false);

    result.subscribers = [];

    result.parent = this.parent;

    // Clone the current operator chain to the new sink
    if (this.head) {
      const [head, tail] = this.cloneOperatorChain(this.head, this.tail);
      result.head = head; result.tail = tail;
    }

    return result;
  }

  cloneOperatorChain(head: Operator, tail?: Operator): [Operator, Operator] {
    const clonedHead = head.clone();
    let original = head.next;
    let cloned = clonedHead;

    while (original) {
      const clonedOperator = original.clone();
      cloned.next = clonedOperator;
      cloned = clonedOperator;
      if (original === tail) {
        break;
      }
      original = original.next;
    }

    return [clonedHead, cloned];
  }

  combine(operator: Operator, stream: Stream<T>) {
    return stream;
  }

  async emit(emission: Emission, next: Operator): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.isCancelled()) {
        currentEmission.isCancelled = true;
      }

      currentEmission = await (next?.process(currentEmission, this) ?? Promise.resolve(currentEmission));

      if (!(currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed)) {
        await Promise.all(this.subscribers.map((subscriber) => (subscriber instanceof Function) ? subscriber(currentEmission.value) : Promise.resolve()));
      }

      currentEmission.isComplete = true;
    } catch (error: any) {
      console.warn(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
    }
  }

  combine(operator: AbstractOperator, stream: AbstractStream) {

    let current: AbstractStream | undefined = this;
    while(current?.next !== undefined) {
      current = current.next;
    }

    let subscribers = current.subscribers.slice();
    const callback = () => {};

    current.sunscribers.push(callback);
    
    let next = stream;
    next.subscribers = subscribers;

    const originalUnsubscribe = next.unsubscribe.bind(next);
    next.unsubscribe = function (callbackMethod: (value: any) => any) {
      originalUnsubscribe(callbackMethod);
      if (next.subscribers.length === 0) {
        current.unsubscribe(callback);
      }
    };
    
    current.next = next;
    return next;
  }
}
