import { Stream, Subscription } from "../abstractions"; // Assuming you have these types
import { createSubject } from "../streams"; // Assuming createSubject is in utils.

export function concat<T = any>(...sources: Stream<T>[]): Stream<T> {
  const subject = createSubject<T>();
  let currentSourceIndex = 0;
  let currentSubscription: Subscription | null = null;

  const subscribeToNextSource = () => {
    if (currentSourceIndex >= sources.length) {
      subject.complete();
      return;
    }

    const currentSource = sources[currentSourceIndex];
    currentSubscription = currentSource.subscribe({
      next: (value) => {
        subject.next(value);
      },
      complete: () => {
        currentSubscription?.unsubscribe();
        currentSubscription = null;
        currentSourceIndex++;
        subscribeToNextSource();
      },
      error: (error) => {
        subject.error(error);
      }
    });
  };

  subscribeToNextSource();

  subject.name = 'concat';
  return subject;
}
