import { createMapper, Operator, StreamMapper } from "../abstractions";
import { createSubject, Subject } from "../streams";
import { createReceiver, Receiver } from "./receiver";
import { createSubscription, Subscription } from "./subscription";

// Basic Stream type definition
export type Stream<T = any> = {
  type: "stream" | "subject";
  name?: string;
  subscribe: (callback?: ((value: T) => void) | Receiver<T>) => Subscription;
  pipe: (...steps: (Operator | StreamMapper)[]) => Stream<any>;
};

export function pipeStream<T = any>(
  stream: Stream<T>,
  ...steps: (Operator | StreamMapper)[]
): Stream<T> {
  let currentStream: Stream = stream;
  const operatorGroup: Operator[] = [];
  const mappers: StreamMapper[] = [];

  for (const step of steps) {
    if ('handle' in step) {
      operatorGroup.push(step);
    } else {
      if (operatorGroup.length > 0) {
        const chained = chain(...operatorGroup);
        mappers.push(chained);
        currentStream = chained.output;
        operatorGroup.length = 0;
      }
      mappers.push(step);
      currentStream = step.output instanceof Function ? step.output(currentStream) as unknown as Stream : step.output as Subject;
    }
  }

  if (operatorGroup.length > 0) {
    const chained = chain(...operatorGroup);
    mappers.push(chained);
    currentStream = chained.output;
  }
  
  const originalSubscribe = currentStream.subscribe;
  currentStream.subscribe = (...args: any[]) => {
    const subscription = originalSubscribe.call(currentStream, ...args);
    for (let i = mappers.length - 1; i > 0; i--) {
      const mapper = mappers[i];
      mapper.map(mappers[i - 1].output as Stream<T>, mapper.output);
    }
    mappers[0].map(stream, mappers[0].output);
    return subscription;
  }

  return currentStream;
};

// Modified chain function that returns a StreamMapper
const chain = function <T = any>(...operators: Operator[]): StreamMapper {
  return createMapper(
    `chain-${operators.map(op => op.name).join('-')}`,
    createSubject<T>(),
    (input: Stream<T>, output: Subject<T>) => {
      let isCompleteCalled = false;
      let inputSubscription: Subscription | null = null;
      
      // Only subscribe to input on first subscription
      if (!inputSubscription) {
        inputSubscription = input.subscribe({
          next: (value: T) => {
            let processedValue = value;
            try {
              for (const operator of operators) {
                processedValue = operator.handle(processedValue);
                if (processedValue === undefined) break;
              }
              if (processedValue !== undefined) {
                output.next(processedValue);
              }
            } catch (err) {
              if (!isCompleteCalled) {
                isCompleteCalled = true;
                output.error(err);
                output.complete();
                inputSubscription?.unsubscribe();
                inputSubscription= null;
              }
            }
          },
          error: (err: any) => {
            if (!isCompleteCalled) {
              isCompleteCalled = true;
              output.error(err);
              output.complete();
              inputSubscription?.unsubscribe();
              inputSubscription= null;
            }
          },
          complete: () => {
            if (!isCompleteCalled) {
              isCompleteCalled = true;
              output.complete();
              inputSubscription?.unsubscribe();
              inputSubscription= null;
            }
          }
        });  
      }
  });
};

// The stream factory function
export function createStream<T>(
  name: string,
  generatorFn: (this: Stream<T>) => AsyncGenerator<T, void, unknown>
): Stream<T> {

  async function* generator() {
    try {
      for await (const value of generatorFn.call(stream)) {
        if (value !== undefined) {
          yield value;
        }
      }
    } catch (err: any) {
      throw err;
    }
  }

  const subscribe = (callbackOrReceiver?: ((value: T) => void) | Receiver<T>): Subscription => {
    const receiver = createReceiver(callbackOrReceiver);
    const subscription = createSubscription<T>();
    subscription.listen(generator, receiver);
    return subscription;
  };

  const stream: Stream<T> = {
    type: "stream",
    name,
    subscribe,
    pipe: function (this: Stream, ...steps: (Operator | StreamMapper)[]) { return pipeStream(this, ...steps); }
  };

  return stream;
}
