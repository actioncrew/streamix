import { Stream } from "../abstractions";
import { createSubject } from "./subject";

// Combine multiple streams and emit the latest value from each stream
export function combineLatest<T = any>(
  streams: Stream<T>[]
): Stream<T[]> {
  const subject = createSubject<T[]>();  // Create a subject to emit combined values

  const latestValues: T[] = Array(streams.length).fill(undefined);
  const hasEmitted = Array(streams.length).fill(false);
  let completedStreams = 0;

  // Subscribe to each stream
  for (let i = 0; i < streams.length; i++) {
    streams[i].subscribe({
      next: (value) => {
        latestValues[i] = value;
        hasEmitted[i] = true;

        // Emit values only when all streams have emitted at least once
        if (hasEmitted.every(Boolean)) {
          subject.next([...latestValues]);  // Emit the latest values as an array
        }
      },
      complete: () => {
        completedStreams++;
        if (completedStreams === streams.length) {
          // Complete once all streams have completed
          subject.complete();
        }
      },
    });
  }

  return subject;  // Return the subject stream
}
