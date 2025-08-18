import { CallbackReturnType, createStream, Stream } from "../abstractions";
import { from } from "../streams";

/**
 * Converts a wide variety of input values into a {@link Stream}.
 *
 * This function normalizes different asynchronous or synchronous sources into a
 * unified `Stream<R>` so they can be processed uniformly in operators and pipelines.
 *
 * Supported inputs:
 * - A {@link Stream<R>} (returned as-is).
 * - A {@link CallbackReturnType<R>} (a value or a promise resolving to a value),
 *   wrapped into a single–emission stream.
 * - An array of `R`, converted into a stream using {@link from}.
 *
 * @template R The type of values emitted by the resulting stream.
 * @param value The input source to convert into a stream. Can be a stream, a value,
 * a promise, or an array of values.
 * @returns A {@link Stream<R>} representing the given input.
 */
export function fromAny<R = any>(value: Stream<R> | CallbackReturnType<R> | Array<R>): Stream<R> {
  if (value && typeof value === 'object' && 'type' in value && ['stream', 'subject'].includes(value.type)) {
    return value as Stream<R>;
  }

  if(Array.isArray(value)) {
    return from(value);
  }

  return createStream("wrapped", async function* () {
    yield await (value as CallbackReturnType<R>);
  });
}
