import { createStreamOperator, Stream, StreamOperator } from '../abstractions';

export const finalize = (callback: () => void | Promise<void>): StreamOperator => {
  const operator = (stream: Stream): Stream => {
    stream.emitter.once('finalize', callback);
    return stream;
  };

  return createStreamOperator('finalize', operator);
};
