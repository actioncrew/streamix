import { createMapper, createStream, StreamMapper } from '../abstractions';
import { eachValueFrom } from '../converters';

export const endWith = <T = any>(initialValue: T): StreamMapper => {
  // Wrap the operator logic using createMapper
  return createMapper('endWith', (input) => createStream('endWith', async function* () {
    // Delegate yielding to the input stream.
    yield* eachValueFrom(input);

    // Yield the initial value first.
    yield initialValue;
  }), () => {});
}
