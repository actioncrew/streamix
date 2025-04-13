import { createMapper, Stream, StreamMapper } from "../abstractions";
import { createReplaySubject, ReplaySubject } from "../streams";

export function shareReplay<T>(bufferSize: number = Infinity): StreamMapper {
  let isConnected = false;
  return createMapper('shareReplay', createReplaySubject<T>(bufferSize), (input: Stream<T>, output: ReplaySubject<T>) => {

    if (!isConnected) {
      isConnected = true;
      const subscription = input.subscribe({
        next: (value) => output.next(value),
        error: (err) => output.error(err),
        complete: () => { subscription.unsubscribe(); output.complete(); }
      });
    }
  });
}
