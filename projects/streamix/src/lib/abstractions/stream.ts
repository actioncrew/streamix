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

  subscribe(callback: void | ((value: T) => any)): Subscription {
    this.subscribers.push(callback ?? (() => {}));

    if (this.subscribers.length === 1 && this.isRunning() === false) {
      this.isRunning.resolve(true);

      queueMicrotask(async () => {
        try {
          // Emit start value if defined
          await this.onStart?.process({ stream: this });

          // Run the actual stream logic
          await this.run();

          // Emit end value if defined
          await this.onComplete?.process({ stream: this });
        } catch (error) {
          // Handle error if catchError defined
          await this.onError?.process({ stream: this, error });
          if (this.onError === undefined) {
            this.isFailed.resolve(error);
          }
        } finally {
          // Handle finalize callback
          await this.onStop?.process({ stream: this });

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }

    return { unsubscribe: () => callback instanceof Function ? this.unsubscribe(callback) : Function.prototype };
  }

  nextStream: Stream<T> | undefined = undefined;

  head: Operator | undefined = undefined;
  tail: Operator | undefined = undefined;

  pipe(...operators: Operator[]): Stream<T> {
    const stream = Object.create(Object.getPrototypeOf(this));
    Object.assign(stream, this);

    stream.isAutoComplete = promisified<boolean>(false);
    stream.isCancelled = promisified<boolean>(false);
    stream.isStopRequested = promisified<boolean>(false);

    stream.isFailed = promisified<any>(undefined);
    stream.isStopped = promisified<boolean>(false);
    stream.isUnsubscribed = promisified<boolean>(false);
    stream.isRunning = promisified<boolean>(false);

    stream.subscribers = [];

    stream.nextStream = this.nextStream;
    stream.onStart = this.onStart;
    stream.onComplete = this.onComplete;
    stream.onStop = this.onStop;
    stream.onError = this.onError;

    // Clone the current operator chain to the new sink
    if (this.head) {
      const [head, tail] = this.cloneOperatorChain(this.head, this.tail);
      stream.head = head; stream.tail = tail;
    }

    // Apply operators to the new sink
    stream.applyOperators(...operators);
    return stream;
  }

  private cloneOperatorChain(head: Operator, tail?: Operator): [Operator, Operator] {
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

  applyOperators(...operators: Operator[]) {

    for (const operator of operators) {
      if (operator instanceof Operator) {
        if (!this.head) {
          this.head = operator;
          this.tail = operator;
        } else {
          this.tail!.next = operator;
          this.tail = operator;
        }
      }

      if (operator instanceof StartWithOperator) {
        this.onStart.chain(operator.callback.bind(operator));
      } else if (operator instanceof EndWithOperator) {
        this.onComplete.chain(operator.callback.bind(operator));
      } else if (operator instanceof CatchErrorOperator) {
        this.onError.chain(operator.callback.bind(operator));
      } else if (operator instanceof FinalizeOperator) {
        this.onStop.chain(operator.callback.bind(operator));
      } else if (operator instanceof ReduceOperator) {
        this.onComplete.chain(operator.callback.bind(operator));
      }
    }
    return this;
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

  combine(operator: Operator, stream: Stream<T>) {

    let current: Stream<T> | undefined = this;
    while(current?.nextStream !== undefined) {
      current = current.nextStream;
    }

    let subscribers = current.subscribers.slice();
    const callback = () => {};

    if (current.isRunning()) {
      current.subscribers = [callback];
    } else {
      current.subscribers = []; current.subscribe(callback);
    }

    let next = stream;
    next.head = operator.next; next.tail = operator.next ? current.tail : undefined;

    subscribers.forEach(subscriber => next.subscribe(subscriber));

    const originalUnsubscribe = next.unsubscribe.bind(this);
    next.unsubscribe = function (callbackMethod: (value: any) => any) {
      originalUnsubscribe(callbackMethod);
      if (next.subscribers.length === 0) {
        current.unsubscribe(callback);
      }
    };

    current.tail = operator;
    current.nextStream = next;
    return next;
  }
}
