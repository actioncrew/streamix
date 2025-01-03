import { createStreamOperator, hooks, Stream, StreamOperator } from '../abstractions';

export const finalize = (callback: () => void | Promise<void>): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    stream[hooks].finalize.chain(callback);
    return stream;
  };

  return createStreamOperator('finalize', operator);
};
