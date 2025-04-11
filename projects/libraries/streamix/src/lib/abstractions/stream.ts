import { Operator, StreamMapper } from "../abstractions";
import { createSubject } from "../streams";
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

  let currentStream: Stream<T> = stream;
  const operatorGroup: Operator[] = [];
  const mappers: StreamMapper[] = [];

  // Group consecutive simple operators
  for (const step of steps) {
    if ('handle' in step) {
      operatorGroup.push(step);
    } else {
      // Flush operator group if we hit a mapper
      if (operatorGroup.length > 0) {
        mappers.push(chainOperators(currentStream, ...operatorGroup));
        currentStream = mappers[mappers.length - 1].output;
        operatorGroup.length = 0;
      }
      mappers.push(step);
      currentStream = step.output;
    }
  }

  // Flush remaining operators
  if (operatorGroup.length > 0) {
    mappers.push(chainOperators(currentStream, ...operatorGroup));
    currentStream = mappers[mappers.length - 1].output;
  }
  
  // Return a stream that builds the pipeline lazily
  return {
    ...currentStream,
    subscribe: (...args) => {
      const subscription = currentStream.subscribe(...args);
      // Apply mappers in reverse order
      for (let i = mappers.length - 1; i >= 0; i--) {
        const mapper = mappers[i];
        const source = i === 0 ? stream : mappers[i - 1].output;
        mapper.map(source, mapper.output);
      }
      return subscription;
    }
  };
}

// Modified chain function that returns a StreamMapper
const chain = function <T>(input: Stream<T>, ...operators: Operator[]): StreamMapper<T> {
  const output = createSubject<T>();

  return createMapper(
    `chain-${operators.map(op => op.name).join('-')}`,
    output,
    (inputStream, outputStream) => {
      let isCompleteCalled = false;
      const subscription = inputStream.subscribe({
        next: (value: T) => {
          let processedValue = value;
          let errorOccurred = false;

          for (const operator of operators) {
            try {
              processedValue = operator.handle(processedValue);
              if (processedValue === undefined) break;
            } catch (error) {
              errorOccurred = true;
              outputStream.error(error);
              break;
            }
          }

          if (!errorOccurred && processedValue !== undefined) {
            outputStream.next(processedValue);
          }
        },
        error: (err: any) => outputStream.error(err),
        complete: () => {
          if (!isCompleteCalled) {
            isCompleteCalled = true;
            outputStream.complete();
            subscription.unsubscribe();
          }
        }
      });
    }
  );
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
    pipe: (...steps: (Operator | StreamMapper)[]) => pipeStream(stream, ...steps),
  };

  return stream;
}
