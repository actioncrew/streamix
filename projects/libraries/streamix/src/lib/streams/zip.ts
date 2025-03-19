import { Stream } from "../abstractions";
import { createSubject } from "../streams";

// Combine multiple streams by emitting values when all streams emit
export function zip(streams: Stream<any>[]): Stream<any[]> {
  const subject = createSubject<any[]>();  // Create a Subject to handle emissions

  const latestValues: any[] = Array(streams.length).fill(undefined);
  const hasEmitted = Array(streams.length).fill(false);
  let completedStreams = 0;

  // Wrap the streams with subscription logic
  streams.forEach((stream, index) => {
    stream.subscribe({
      next: (value) => {
        latestValues[index] = value;
        hasEmitted[index] = true;

        // Emit the combined value when all streams have emitted
        if (hasEmitted.every(Boolean)) {
          subject.next([...latestValues as any[]]);  // Emit the tuple of latest values
          latestValues.fill(undefined);  // Reset the values for the next emission
          hasEmitted.fill(false);  // Reset the emit flags
        }
      },
      complete: () => {
        completedStreams++;
        if (completedStreams === streams.length) {
          // Complete the subject when all streams have completed
          subject.complete();
        }
      },
      error: (err) => subject.error(err),  // Pass errors to the subject
    });
  });

  subject.name = 'zip';
  return subject;  // Return the subject that acts as a combined stream
}
