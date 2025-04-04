import { Stream } from "../abstractions";
import { createSubject } from "../streams";

export function race<T>(...streams: Stream<T>[]): Stream<T> {
  const subject = createSubject<T>();
  let winnerIndex = -1;
  const subscriptions: { unsubscribe: () => void }[] = [];
  let unsubscribed = false;

  const unsubscribeOthers = (winnerSub: { unsubscribe: () => void }) => {
    if (!unsubscribed) {
      unsubscribed = true;
      for (const s of subscriptions) {
        if (s !== winnerSub) s.unsubscribe();
      }
    }
  };

  const winnerPromise = new Promise<number>((resolve) => {
    streams.forEach((stream, index) => {
      const sub = stream.subscribe({
        next: async (value) => { // Make the callback async
          if (winnerIndex === -1) {
            winnerIndex = index;
            resolve(winnerIndex);
            await winnerPromise; // Await the promise
            unsubscribeOthers(sub);
          }

          if (index === winnerIndex) {
            subject.next(value);
          }
        },
        error: async (err) => { // Make the callback async
          if (winnerIndex === -1) {
            winnerIndex = index;
            resolve(winnerIndex);
            await winnerPromise; // Await the promise
            unsubscribeOthers(sub);
          }

          if (index === winnerIndex) {
            subject.error(err);
          }
        },
        complete: async () => { // Make the callback async
          if (winnerIndex === -1) {
            winnerIndex = index;
            resolve(winnerIndex);
            await winnerPromise; // Await the promise
            unsubscribeOthers(sub);
          }

          if (index === winnerIndex) {
            subject.complete();
          }
        },
      });

      subscriptions.push(sub);
    });
  });

  subject.name = 'race';
  return subject;
}
