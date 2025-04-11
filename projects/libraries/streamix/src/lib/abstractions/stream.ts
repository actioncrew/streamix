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
  let finalStream: Stream<T> | undefined;

  const buildPipeline = () => {
    let currentStream: Stream<T> = stream;
    const mappers: StreamMapper[] = [];

    for (const step of steps) {
      if ('handle' in step) {
        // For operators, create a StreamMapper that chains them
        const operatorMapper = chain(currentStream, step);
        mappers.push(operatorMapper);
        currentStream = operatorMapper.output;
      } else if ('map' in step) {
        // For existing mappers, just add them
        mappers.push(step);
        currentStream = step.output;
      }
    }

    // Create final stream that applies all mappers on subscription
    const output = createSubject<T>();
    return {
      stream: {
        ...currentStream,
        subscribe: (...args) => {
          mappers.forEach(mapper => mapper.map(currentStream, mapper.output));
          return output.subscribe(...args);
        }
      },
      output
    };
  };

  // Return a stream that builds the pipeline lazily
  return {
    ...stream,
    subscribe: (...args) => {
      if (!finalStream) {
        const { stream: builtStream, output } = buildPipeline();
        finalStream = builtStream;
      }
      return finalStream.subscribe(...args);
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
