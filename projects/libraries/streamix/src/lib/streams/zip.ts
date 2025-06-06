import { Stream } from "../abstractions";
import { Subscription } from "../abstractions/subscription";
import { createSubject } from "../streams";

// Combine multiple streams by emitting values when all have emitted
export function zip(streams: Stream<any>[]): Stream<any[]> {
  const subject = createSubject<any[]>(); // Combined stream output
  const subscriptions: Subscription[] = [];

  const latestValues: any[] = Array(streams.length).fill(undefined);
  const hasEmitted: boolean[] = Array(streams.length).fill(false);
  let completedStreams = 0;

  // Subscribe to each input stream
  streams.forEach((stream, index) => {
    const subscription = stream.subscribe({
      next: (value) => {
        latestValues[index] = value;
        hasEmitted[index] = true;

        // Emit when all streams have emitted at least once
        if (hasEmitted.every(Boolean)) {
          subject.next([...latestValues]);
          latestValues.fill(undefined);
          hasEmitted.fill(false);
        }
      },

      complete: () => {
        completedStreams++;
        if (completedStreams === streams.length) {
          subject.complete();
          subscriptions.forEach(sub => sub.unsubscribe());
        }
      },

      error: (err) => {
        subject.error(err);
        subscriptions.forEach(sub => sub.unsubscribe());
      }
    });

    subscriptions.push(subscription);
  });

  subject.name = "zip";
  return subject;
}
