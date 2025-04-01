import { Stream } from "../abstractions";
import { createSubject } from "../streams";

/**
 * Emits values from the first stream that emits, ignoring all other streams
 * @param streams Array of streams to race
 * @returns Stream that emits values from the winning stream
 */
export function race<T>(streams: Stream<T>[]): Stream<T> {
  const subject = createSubject<T>();
  let winnerFound = false;
  const subscriptions: { unsubscribe: () => void }[] = [];

  streams.forEach(stream => {
    const sub = stream.subscribe({
      next: (value) => {
        if (!winnerFound) {
          winnerFound = true;
          // Unsubscribe all other streams
          subscriptions.forEach(s => {
            if (s !== sub) s.unsubscribe();
          });
        }
        subject.next(value);
      },
      error: (err) => {
        if (!winnerFound) {
          winnerFound = true;
          subscriptions.forEach(s => {
            if (s !== sub) s.unsubscribe();
          });
        }
        subject.error(err);
      },
      complete: () => {
        if (!winnerFound) {
          winnerFound = true;
          subscriptions.forEach(s => {
            if (s !== sub) s.unsubscribe();
          });
        }
        subject.complete();
      }
    });
    subscriptions.push(sub);
  });

  subject.name = 'race';
  return subject;
}
