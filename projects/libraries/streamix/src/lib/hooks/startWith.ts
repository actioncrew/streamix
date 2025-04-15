import { createMapper, createStream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';

export const startWith = <T = any>(initialValue: T): StreamMapper => {
  // Wrap the operator logic using createMapper
  return createMapper('startWith', (input) => createStream('startWith', async function* () {
    // Yield the initial value first.
    yield initialValue;

    // Delegate yielding to the input stream.
    yield* eachValueFrom(input);
  }), () => {});
}
