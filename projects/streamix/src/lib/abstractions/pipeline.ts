import { PromisifiedType } from './../utils/promisified';
import { Chunk, Stream } from '../abstractions';
import { Subject } from '../';
import { hook, HookType } from '../utils';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';
import { pipe } from 'rxjs';


export function Pipeline<T = any>(stream: ReturnType<typeof Stream<T>>) {
  const chunks: ReturnType<typeof Chunk<T>>[] = [Chunk(stream)];
  const operators: Operator[] = [];
  const onPipelineError: HookType = hook();
  let currentValue: T | undefined;

  const firstChunk = () => chunks[0];
  const lastChunk = () => chunks[chunks.length - 1];

  const bindOperators = (...newOperators: Operator[]) => {
    let currentChunk = firstChunk();
    let chunkOperators: Operator[] = [];

    newOperators.forEach(operator => {
      if (operator instanceof Operator) {
        const clonedOperator = operator.clone();
        clonedOperator.init(currentChunk.stream);
        chunkOperators.push(clonedOperator);

        if ('stream' in clonedOperator) {
          currentChunk.bindOperators(...chunkOperators);
          chunkOperators = [];
          currentChunk = Chunk(clonedOperator.stream as any);
          chunks.push(currentChunk);
        }
      }
    });

    currentChunk.bindOperators(...chunkOperators);

    chunks.forEach(chunk => {
      chunk.onError.chain({ errorCallback }, errorCallback);
    });
  };

  const subscribers = (): HookType => {
    return lastChunk().subscribers;
  }

  const shouldComplete = (): boolean => {
    return lastChunk().shouldComplete();
  }

  const awaitCompletion = (): Promise<void> => {
    return lastChunk().awaitCompletion();
  }

  const complete = async () => {
    await Promise.all(chunks.map(chunk => chunk.complete()));
  };

  const errorCallback = async (error: any) => {
    await onPipelineError.process(error);
  };

  const start = () => {
    chunks.forEach(chunk => chunk.stream.startWithContext(chunk));
  };

  const subscribe = (callback?: ((value: T) => void) | void): Subscription => {
    const boundMethod = {
      method: (value: T) => {
        currentValue = value;
        return callback === undefined ? Promise.resolve() : Promise.resolve(callback(value));
      }
    };

    bindOperators(...operators);
    subscribers().chain(boundMethod, boundMethod.method);

    start();

    return {
      unsubscribe: async () => {
          subscribers().remove(boundMethod, boundMethod.method);
          if (subscribers().length === 0) {
              lastChunk().isUnsubscribed.resolve(true);
              await complete();
          }
      }
    };
  }

  // Return a function with attached properties that behaves like an object
  const pipeline = () => currentValue;

  pipeline.pipe = (...newOperators: Operator[]) => {
    operators.push(...newOperators);
    return pipeline;
  };

  pipeline.onStart = firstChunk().onStart;
  pipeline.onComplete = lastChunk().onComplete;
  pipeline.onStop = lastChunk().onStop;
  pipeline.onError = onPipelineError;
  pipeline.onEmission = lastChunk().onEmission;

  pipeline.isAutoComplete = lastChunk().isAutoComplete;
  pipeline.isStopRequested = lastChunk().isStopRequested;
  pipeline.isFailed = lastChunk().isFailed;
  pipeline.isStopped = lastChunk().isStopped;
  pipeline.isUnsubscribed = lastChunk().isUnsubscribed;
  pipeline.isRunning = lastChunk().isRunning;

  pipeline.start = start;
  pipeline.shouldComplete = shouldComplete;
  pipeline.awaitCompletion = awaitCompletion;
  pipeline.complete = complete;

  pipeline.subscribers = lastChunk().subscribers;
  pipeline.subscribe = subscribe;

  return pipeline;
}


export function multicast<T = any>(source: Subscribable<T>): Subscribable<T> {
  const subject = Subject<T>();
  const subscription = source.subscribe((value) => subject.next(value));
  source.isStopped.then(() => subject.complete());

  const pipeline = Pipeline<T>(subject);
  const originalSubscribe = pipeline.subscribe.bind(pipeline);
  let subscribers = 0;

  pipeline.subscribe = (callback?: ((value: T) => void) | void) => {
    const originalSubscription = originalSubscribe(callback);
    subscribers++;
    return {
      unsubscribe: () => {
        originalSubscription.unsubscribe();
        if(--subscribers === 0) {
          subscription.unsubscribe();
        }
      }
    };
  };

  return pipeline;
}
