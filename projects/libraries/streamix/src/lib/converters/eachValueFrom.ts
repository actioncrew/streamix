import { Stream } from "../abstractions";

export async function* eachValueFrom<T>(stream: Stream<T>): AsyncGenerator<T> {
  yield* stream;
}
