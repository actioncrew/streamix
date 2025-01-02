import { hooks, Stream, StreamOperator } from '../abstractions';

export const finalize = (callback: () => void | Promise<void>): StreamOperator => {

  // Return the stream as required by StreamOperator type
  return (stream: Stream): Stream => {
    stream[hooks].finalize.chain(callback);
    return stream;
  };
};
