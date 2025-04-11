import { createMapper, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject, Subject, timer } from "../streams";

export function buffer<T = any>(period: number): StreamMapper {
  return createMapper('buffer', createSubject<T[]>(), (input: Stream<T>, output: Subject<T[]>) => {
    let buffer: T[] = [];
    let intervalSubscription: Subscription | null = null;
    let inputSubscription: Subscription | null = null;

    intervalSubscription = timer(period, period).subscribe({
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
  });
}
