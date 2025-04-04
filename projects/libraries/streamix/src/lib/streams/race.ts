import { Stream } from "../abstractions";
import { createSubject } from "../streams";

export function race<T>(...streams: Stream<T>[]): Stream<T> {
  const subject = createSubject<T>();
  let winnerIndex = -1;
  const subscriptions: { unsubscribe: () => void }[] = [];

  // Helper to unsubscribe all except the winner
  const unsubscribeOthers = (winnerSub: { unsubscribe: () => void }) => {
    for (const s of subscriptions) {
      if (s !== winnerSub) s.unsubscribe();
    }
  };

  streams.forEach((stream, index) => {
    const sub = stream.subscribe({
      next: (value) => {
        // Delay winner selection to allow all subs to register
          if (winnerIndex === -1) {
            winnerIndex = index;
            queueMicrotask(() => {
              unsubscribeOthers(sub);
            });
          }

          if (index === winnerIndex) {
            subject.next(value);
          }
      },
      error: (err) => {
        if (winnerIndex === -1) {
          winnerIndex = index;
          queueMicrotask(() => {
            unsubscribeOthers(sub);
          });
        }

        if (index === winnerIndex) {
          subject.error(err);
        }
      },
      complete: () => {
          if (winnerIndex === -1) {
            winnerIndex = index;
            queueMicrotask(() => {
              unsubscribeOthers(sub);
            });
          }

          if (index === winnerIndex) {
            subject.complete();
          }
      },
    });

    subscriptions.push(sub);
  });

  subject.name = 'race';
  return subject;
}
