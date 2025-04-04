import { Stream } from "../abstractions";
import { createSubject } from "../streams";

export function race<T>(...streams: Stream<T>[]): Stream<T> {
  const subject = createSubject<T>();
  let winnerIndex = -1;
  const subscriptions: { unsubscribe: () => void }[] = [];
  let raceComplete = false; // Track if a winner has been found

  const unsubscribeOthers = (winnerSub: { unsubscribe: () => void }) => {
    for (const s of subscriptions) {
      if (s !== winnerSub) s.unsubscribe();
    }
    raceComplete = true; // Indicate the race is complete
  };

  streams.forEach((stream, index) => {
    if (raceComplete) return; // Exit early if winner is already found

    const sub = stream.subscribe({
      next: (value: any) => {
        if (winnerIndex === -1) {
          winnerIndex = index;
          unsubscribeOthers(sub);
        }

        if (index === winnerIndex) {
          subject.next(value);
        }
      },
      error: (err: any) => {
        if (winnerIndex === -1) {
          winnerIndex = index;
          unsubscribeOthers(sub);
        }

        if (index === winnerIndex) {
          subject.error(err);
        }
      },
      complete: () => {
        if (winnerIndex === -1) {
          winnerIndex = index;
          unsubscribeOthers(sub);
        }

        if (index === winnerIndex) {
          sub.unsubscribe();
          subject.complete();
        }
      },
    });

    subscriptions.push(sub);
  });

  subject.name = 'race';
  return subject;
}
