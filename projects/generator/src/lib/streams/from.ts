import { Stream } from "../abstractions";
import { createSubject } from "./subject";

export function from<T = any>(source: AsyncIterable<T> | Iterable<T>): Stream<T> {
  const subject = createSubject<T>();  // Create a Subject to handle emissions

  // Wrap the iterable with the subject
  (async () => {
      for await (const value of source) {
        subject.next(value);  // Emit values as they're received
      }
      subject.complete();  // Complete the subject once the source is done
  })();

  return subject;  // Return the Subject which now behaves like a stream
}
