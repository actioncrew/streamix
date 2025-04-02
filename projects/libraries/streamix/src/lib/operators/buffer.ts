import { createMapper, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject, interval } from "../streams";

export function buffer<T = any>(period: number): StreamMapper {
  return createMapper('buffer', (input: Stream<T>): Stream<T[]> => {
    const output = createSubject<T[]>();
    let buffer: T[] = [];
    let intervalSubscription: Subscription | null = null;
    let inputSubscription: Subscription | null = null;

    intervalSubscription = interval(period).subscribe({
      next: () => {
        if (buffer.length > 0) {
          output.next([...buffer]);
          buffer = [];
        }
      },
      error: (err) => output.error(err),
      complete: () => {
        if (buffer.length > 0) {
          output.next([...buffer]);
        }
        output.complete();
      },
    });

    inputSubscription = input.subscribe({
      next: (value) => {
        buffer.push(value);
      },
      error: (err) => output.error(err),
      complete: () => {
        if (buffer.length > 0) {
          output.next([...buffer]);
        }
        intervalSubscription?.unsubscribe();
        inputSubscription?.unsubscribe();
        output.complete();
      },
    });

    return output;
  });
                                     }
