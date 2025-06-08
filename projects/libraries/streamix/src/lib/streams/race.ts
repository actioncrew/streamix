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

    const subscription = stream.subscribe({
      next: (value: any) => {
        if (winnerIndex === -1) {
          winnerIndex = index;
          unsubscribeOthers(subscription);
        }

        if (index === winnerIndex) {
          subject.next(value);
        }
      },
      error: (err: any) => {
        if (winnerIndex === -1) {
          winnerIndex = index;
          unsubscribeOthers(subscription);
        }

        if (index === winnerIndex) {
          subject.error(err);
        }
        subscription.unsubscribe();
      },
      complete: () => {
        if (winnerIndex === -1) {
          winnerIndex = index;
          unsubscribeOthers(subscription);
        }

        if (index === winnerIndex) {
          subject.complete();
        }
        subscription.unsubscribe();
      },
    });

    subscriptions.push(subscription);
  });

  subject.name = 'race';
  return subject;
}
