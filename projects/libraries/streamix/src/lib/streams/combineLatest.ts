import { Stream, Subscription } from "../abstractions";
import { createSubject } from "../streams";

// Combine multiple streams and emit the latest value from each stream
export function combineLatest<T = any>(streams: Stream<T>[]): Stream<T[]> {
  const subject = createSubject<T[]>(); // Create subject to emit combined values
  const latestValues: T[] = Array(streams.length).fill(undefined);
  const hasEmitted = Array(streams.length).fill(false);
  let completedStreams = 0;
  let subscriptions: Subscription[] = [];

  // Subscribe to each stream and store the subscription
  for (let i = 0; i < streams.length; i++) {
    const sub = streams[i].subscribe({
      next: (value) => {
        latestValues[i] = value;
        hasEmitted[i] = true;

        // Emit values only when all streams have emitted at least once
        if (hasEmitted.every(Boolean)) {
          subject.next([...latestValues]); // Emit the latest values as an array
        }
      },
      complete: () => {
        completedStreams++;
        if (completedStreams === streams.length) {
          subject.complete(); // Complete once all streams are completed
        }
      },
    });

    subscriptions.push(sub);
  }

  // Override unsubscribe to properly clean up
  const originalComplete = subject.complete;
  subject.complete = () => {
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
    subscriptions = []; // Clear subscriptions
    originalComplete.call(subject);
  };

  subject.name = "combineLatest";
  return subject; // Return the subject stream
}
