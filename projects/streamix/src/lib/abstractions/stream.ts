import { CatchErrorHook, EndWithHook, FinalizeHook, StartWithHook } from '../hooks';
import { Promisified } from './../utils/promisified';
import { Emission } from './emission';
import { AbstractHook } from './hook';
import { AbstractOperator } from './operator';
import { Subscription } from './subscription';

export class AbstractStream {

  isAutoComplete = new Promisified<boolean>(false);
  isCancelled = new Promisified<boolean>(false);
  isStopRequested = new Promisified<boolean>(false);

  isFailed = new Promisified<any>(undefined);
  isStopped = new Promisified<boolean>(false);
  isUnsubscribed = new Promisified<boolean>(false);
  isRunning = new Promisified<boolean>(false);

  subscribers: (((value: any) => any) | void)[] = [];

  onStart?: AbstractHook | undefined;
  onComplete?: AbstractHook | undefined;
  onStop?: AbstractHook | undefined;
  onError?: AbstractHook | undefined;

  run(): Promise<void> {
    throw new Error('Method is not implemented.');
  }

  shouldTerminate() {
    return this.isCancelled.value || this.isFailed.value;
  }

  awaitTermination() {
    return Promise.race([this.isCancelled.promise, this.isFailed.promise]);
  }

  terminate(): Promise<void> {
    this.isCancelled.resolve(true);
    return this.isStopped.then(() => Promise.resolve());
  }

  shouldComplete() {
    return this.isAutoComplete.value || this.isUnsubscribed.value || this.isStopRequested.value;
  }

  awaitCompletion() {
    return Promise.race([this.isAutoComplete.promise, this.isUnsubscribed.promise, this.isStopRequested.promise]);
  }

  complete(): Promise<void> {
    this.isStopRequested.resolve(true);
    return this.isRunning.value ? this.isStopped.then(() => Promise.resolve()) : Promise.resolve();
  }

  unsubscribe(callback: (value: any) => any): void {
    this.subscribers = this.subscribers.filter(subscriber => subscriber !== callback);
    if (this.subscribers.length === 0) {
      this.isStopRequested.resolve(true);
      this.isUnsubscribed.resolve(true);
    }
  }

  subscribe(callback: void | ((value: any) => any)): Subscription {
    this.subscribers.push(callback ?? (() => {}));

    if (this.subscribers.length === 1 && this.isRunning.value === false) {
      queueMicrotask(async () => {
        try {
          this.isRunning.resolve(true);

          // Emit start value if defined
          await this.onStart?.process(this);

          // Run the actual stream logic
          await this.run();

          // Emit end value if defined
          await this.onComplete?.process(this);
        } catch (error) {
          // Handle error if catchError defined
          await this.onError?.process(this, { error });
          if (this.onError === undefined) {
            this.isFailed.resolve(error);
          }
        } finally {
          // Handle finalize callback
          await this.onStop?.process(this);

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }

    return { unsubscribe: () => callback instanceof Function ? this.unsubscribe(callback) : Function.prototype };
  }

  nextStream: AbstractStream | undefined = undefined;

  head: AbstractOperator | undefined = undefined;
  tail: AbstractOperator | undefined = undefined;

  pipe(...operators: (AbstractOperator | AbstractHook)[]): AbstractStream {
    const stream = Object.create(Object.getPrototypeOf(this));
    Object.assign(stream, this);

    stream.isAutoComplete = new Promisified<boolean>(false);
    stream.isCancelled = new Promisified<boolean>(false);
    stream.isStopRequested = new Promisified<boolean>(false);

    stream.isFailed = new Promisified<any>(undefined);
    stream.isStopped = new Promisified<boolean>(false);
    stream.isUnsubscribed = new Promisified<boolean>(false);
    stream.isRunning = new Promisified<boolean>(false);

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

  private cloneOperatorChain(head: AbstractOperator, tail?: AbstractOperator): [AbstractOperator, AbstractOperator] {
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

  applyOperators(...operators: (AbstractOperator | AbstractHook)[]) {

    for (const operator of operators) {
      if (operator instanceof AbstractOperator) {
        if (!this.head) {
          this.head = operator;
          this.tail = operator;
        } else {
          this.tail!.next = operator;
          this.tail = operator;
        }
      } else if (operator instanceof StartWithHook) {
        this.onStart = operator;
      } else if (operator instanceof EndWithHook) {
        this.onComplete = operator;
      } else if (operator instanceof CatchErrorHook) {
        this.onError = operator;
      } else if (operator instanceof FinalizeHook) {
        this.onStop = operator;
      } else {
        throw new Error("Unknown hook");
      }
    }
    return this;
  }

  async emit(emission: Emission): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.isCancelled.value) {
        currentEmission.isCancelled = true;
      }

      currentEmission = await (this.head?.process(currentEmission, this) ?? Promise.resolve(currentEmission));

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
    while(current?.nextStream !== undefined) {
      current = current.nextStream;
    }

    let subscribers = current.subscribers.slice();
    const callback = () => {};

    if (current.isRunning.value) {
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
