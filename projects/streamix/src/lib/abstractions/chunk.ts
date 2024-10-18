import { Pipeline, Stream } from '../abstractions';
import { hook } from '../utils';
import { Emission } from './emission';
import { Operator } from './operator';
import { Subscribable } from './subscribable';

export function Chunk<T = any>(stream: ReturnType<typeof Stream<T>>) {
  let operators: Operator[] = [];
  let head: Operator | undefined;
  let tail: Operator | undefined;

  const onEmission = hook();
  const subscribers = hook();
  let currentValue: T | undefined;

  const init = () => {
    if (!stream.onEmission.contains(chunk, emit)) {
      stream.onEmission.chain(chunk, emit);
    }
  };

  const startWithContext = (context: any) => {
    context.init();
    return stream.startWithContext(context);
  };

  const cleanup = async () => {
    stream.onEmission.remove(chunk, emit);
  };

  const run = (): Promise<void> => {
    return stream.run();
  };

  const pipe = (...ops: Operator[]): Subscribable<T> => {
    return Pipeline<T>(stream).pipe(...operators, ...ops);
  };

  const bindOperators = (...ops: Operator[]): Subscribable<T> => {
    operators = [];
    head = undefined;
    tail = undefined;

    ops.forEach((operator, index) => {
      if (operator instanceof Operator) {
        operators.push(operator);

        if (!head) {
          head = operator;
        } else {
          tail!.next = operator;
        }
        tail = operator;

        if ('stream' in operator && index !== ops.length - 1) {
          throw new Error('Only the last operator in a chunk can contain outerStream property.');
        }
      }
    });

    return chunk;
  };

  const emit = async ({ emission, source }: { emission: Emission; source: any }): Promise<void> => {
    try {
      let next = source instanceof Stream ? head : undefined;
      next = source instanceof Operator ? source.next : next;

      if (emission.isFailed) {
        throw emission.error;
      }

      if (!emission.isPhantom) {
        emission = await (next?.process(emission, chunk) ?? Promise.resolve(emission));
      }

      if (emission.isFailed) {
        throw emission.error;
      }

      if (!emission.isPhantom) {
        await onEmission.parallel({ emission, source: chunk });
        await subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;

      stream.isFailed.resolve(error);
      if (stream.onError.length > 0) {
        await stream.onError.process({ error });
      }
    }
  };

  // The chunk function that returns the current value
  const chunk = () => currentValue;

  // Attach properties and methods
  chunk.stream = stream;
  chunk.operators = operators;
  chunk.head = head;
  chunk.tail = tail;
  chunk.onEmission = onEmission;
  chunk.subscribers = subscribers;

  chunk.isAutoComplete = stream.isAutoComplete;
  chunk.isStopRequested = stream.isStopRequested;
  chunk.isFailed = stream.isFailed;
  chunk.isStopped = stream.isStopped;
  chunk.isUnsubscribed = stream.isUnsubscribed;
  chunk.isRunning = stream.isRunning;
  chunk.subscribers = subscribers;
  chunk.onStart = stream.onStart;
  chunk.onComplete = stream.onComplete;
  chunk.onStop = stream.onStop;
  chunk.onError = stream.onError;
  chunk.onEmission = onEmission;

  chunk.init = init;
  chunk.start = () => stream.startWithContext(chunk);
  chunk.shouldComplete = stream.shouldComplete;
  chunk.awaitCompletion = stream.awaitCompletion;
  chunk.complete = stream.complete;
  chunk.subscribe = stream.subscribe;
  chunk.startWithContext = startWithContext;
  chunk.cleanup = cleanup;
  chunk.run = run;
  chunk.pipe = pipe;
  chunk.bindOperators = bindOperators;
  chunk.emit = emit;

  return chunk;
}
