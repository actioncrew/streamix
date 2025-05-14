import { createMapper, Stream, StreamMapper, Subscription } from "../abstractions";
import { createSubject, Subject, timer } from "../streams";

export function buffer<T = any>(period: number): StreamMapper {
  return createMapper('buffer', createSubject<T[]>(), (input: Stream<T>, output: Subject<T[]>) => {
    let buffer: T[] = [];
    let intervalSubscription: Subscription | null = null;
    let inputSubscription: Subscription | null = null;
    let completed = false;

    const flush = () => {
      if (buffer.length > 0) {
        output.next([...buffer]);
        buffer = [];
      }
    };

    const cleanup = () => {
      intervalSubscription?.unsubscribe();
      inputSubscription?.unsubscribe();
    };

    intervalSubscription = timer(period, period).subscribe({
      next: () => {
        flush();
      },
      error: (err) => {
        cleanup();
        output.error(err);
      },
      complete: () => {
        flush();
        cleanup();
        if (!completed) {
          completed = true;
          output.complete();
        }
      },
    });

    inputSubscription = input.subscribe({
      next: (value) => {
        buffer.push(value);
      },
      error: (err) => {
        cleanup();
        output.error(err);
      },
      complete: () => {
        flush();
        cleanup();
        if (!completed) {
          completed = true;
          output.complete();
        }
      },
    });
  });
}
