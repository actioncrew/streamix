import { CatchErrorHook, EndWithHook, FinalizeHook, StartWithHook } from '../hooks';
import { Promisified } from './../utils/promisified';
import { Emission } from './emission';
import { AbstractHook } from './hook';
import { AbstractOperator } from './operator';
import { Subscription } from './subscription';

export interface IStream {
  isAutoComplete: Promisified<boolean>;
  isCancelled: Promisified<boolean>;
  isStopRequested: Promisified<boolean>;
  isFailed: Promisified<any>;
  isStopped: Promisified<boolean>;
  isUnsubscribed: Promisified<boolean>;
  isRunning: Promisified<boolean>;

  subscribers: (((value: any) => any) | void)[];

  onStart?: AbstractHook;
  onComplete?: AbstractHook;
  onStop?: AbstractHook;
  onError?: AbstractHook;

  emit(emission: Emission): Promise<void>;
  shouldTerminate(): boolean;
  awaitTermination(): Promise<boolean>;
  terminate(): Promise<void>;
  shouldComplete(): boolean;
  awaitCompletion(): Promise<boolean>;
  complete(): Promise<void>;
  pipe(...operators: (AbstractOperator | AbstractHook)[]): StreamSink;
  run(): Promise<void>;
  subscribe(callback: void | ((value: any) => any)): Subscription;
  unsubscribe(callback: (value: any) => any): void;
}

export class AbstractStream implements IStream {

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

  async emit(emission: Emission): Promise<void> {
    try {
      let currentEmission: Emission = emission;

      if (this.isCancelled.value) {
        currentEmission.isCancelled = true;
      }

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
    return this.isStopped.then(() => Promise.resolve());
  }

  pipe(...operators: (AbstractOperator | AbstractHook)[]): StreamSink {
    // Create a new sink based on the current one
    const newSink = new StreamSink(this);
    // Apply operators and hooks to the new sink
    newSink.applyOperators(...operators);

    return newSink;
  }

  run(): Promise<void> {
    throw new Error('Method is not implemented.');
  }

  unsubscribe(callback: (value: any) => any): void {
    this.subscribers = this.subscribers.filter(subscriber => subscriber !== callback);
    if (this.subscribers.length === 0) {
      this.isStopRequested.resolve(true);
      this.isUnsubscribed.resolve(true);
    }
  }

  subscribe(callback: void | ((value: any) => any)): Subscription {
    this.subscribers.push(callback);

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
}

export class StreamSink implements IStream {
  protected source: any;
  protected next: StreamSink | undefined = undefined;

  protected head: AbstractOperator | undefined = undefined;
  protected tail: AbstractOperator | undefined = undefined;

  constructor(source: AbstractStream) {
    this.source = source;
    
    // Proxy all other properties and methods from source
    let proxy = new Proxy(this, {
      get: (target: any, prop: string | symbol) => {
        if (Reflect.has(target, prop)) {
          return target[prop];
        }
        return this.source[prop];
      },
      set: (target: any, prop: string | symbol, value: any) => {
        if (Reflect.has(target, prop)) {
          target[prop] = value;
        } else {
          this.source[prop] = value;
        }
        return true;
      },
      defineProperty: (target: any, prop: string | symbol, descriptor: PropertyDescriptor) => {
        if (Reflect.has(target, prop)) {
          Reflect.defineProperty(target, prop, descriptor);
        } else {
          Reflect.defineProperty(this.source, prop, descriptor);
        }
        return true;
      },
      deleteProperty: (target: any, prop: string | symbol) => {
        if (Reflect.has(target, prop)) {
          return Reflect.deleteProperty(target, prop);
        } else {
          return Reflect.deleteProperty(this.source, prop);
        }
      }
    });

    this.source.emit = this.emit.bind(proxy);
    return proxy;
  }

  isAutoComplete!: Promisified<boolean>;
  isCancelled!: Promisified<boolean>;
  isStopRequested!: Promisified<boolean>;
  isFailed!: Promisified<any>;
  isStopped!: Promisified<boolean>;
  isUnsubscribed!: Promisified<boolean>;
  isRunning!: Promisified<boolean>;
  subscribers!: (void | ((value: any) => any))[];
  
  onStart!: AbstractHook | undefined;
  onComplete!: AbstractHook | undefined;
  onStop!: AbstractHook | undefined;
  onError!: AbstractHook | undefined;

  shouldTerminate!: () => boolean;
  awaitTermination!: () => Promise<boolean>;
  terminate!: () => Promise<void>;

  shouldComplete!: () => boolean;
  awaitCompletion!: () => Promise<boolean>;
  complete!: () => Promise<void>;

  run!:() => Promise<void>;

  subscribe!: (callback: void | ((value: any) => any)) => Subscription;
  unsubscribe!: (callback: (value: any) => any) => void;

  pipe(...operators: (AbstractOperator | AbstractHook)[]): StreamSink {
    const newSink = new StreamSink(this.source);
    newSink.next = this.next;

    // Clone the current operator chain to the new sink
    if (this.head) {
      const [head, tail] = this.cloneOperatorChain(this.head, this.tail);
      newSink.head = head; newSink.tail = tail;
    }
    
    // Apply operators to the new sink
    newSink.applyOperators(...operators);
    return newSink;
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

  split(operator: AbstractOperator, stream: AbstractStream) {
    
    let current: StreamSink | undefined = this;
    while(current.next !== undefined) {
      current = current.next;
    }

    let subscribers = current.subscribers.slice();
    const callback = () => {};
    current.subscribers = [callback];

    let next = stream instanceof StreamSink ? stream : new StreamSink(stream);
    next.head = operator.next; next.tail = current.tail;

    subscribers.forEach(subscriber => next.subscribe(subscriber));

    next.unsubscribe = new Proxy(this.unsubscribe, {
      apply: (targetUnsubscribe, thisArg, argumentsList: any) => {
        targetUnsubscribe.apply(thisArg, argumentsList);
        if (next.subscribers.length === 0) {
          current.unsubscribe(callback)
        }
      }
    });

    current.tail = operator;
    current.next = next;
    return next;
  }
}
