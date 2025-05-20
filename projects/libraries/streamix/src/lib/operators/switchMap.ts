import { createOperator, Stream, Subscription } from "../abstractions";
import { eachValueFrom } from '../converters';
import { createSubject } from "../streams";

export function switchMap<T, R>(project: (value: T, index: number) => Stream<R>) {
  return createOperator("switchMap", (source) => {
    const output = createSubject<R>();

    let currentSubscription: Subscription | null = null;
    let inputCompleted = false;
    let currentInnerStreamId = 0;
    let index = 0;

    const checkComplete = () => {
      if (inputCompleted && !currentSubscription) {
        output.complete();
      }
    };

    const subscribeToInner = (innerStream: Stream<R>, streamId: number) => {
      if (currentSubscription) {
        currentSubscription.unsubscribe();
        currentSubscription = null;
      }

      currentSubscription = innerStream.subscribe({
        next: (value) => {
          if (streamId === currentInnerStreamId) {
            output.next(value);
          }
        },
        error: (err) => {
          if (streamId === currentInnerStreamId) {
            output.error(err);
          }
        },
        complete: () => {
          if (streamId === currentInnerStreamId) {
            currentSubscription = null;
            checkComplete();
          }
        },
      });
    };

    (async () => {
      try {
        while (true) {
          const { value, done } = await source.next();
          if (done) break;

          const streamId = ++currentInnerStreamId;
          const innerStream = project(value, index++);
          subscribeToInner(innerStream, streamId);
        }
        inputCompleted = true;
        checkComplete();
      } catch (err) {
        output.error(err);
      }
    })();

    return eachValueFrom(output);
  });
}
