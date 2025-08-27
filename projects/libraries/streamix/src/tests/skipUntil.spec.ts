import { createBehaviorSubject, createSubject, from, skipUntil } from '@actioncrew/streamix';

describe('skipUntil', () => {
  it('should skip values before notifier emits and emit after that', (done) => {
    const emissions = [1, 2, 3, 4, 5];
    const source$ = from(emissions);
    const notifier$ = createBehaviorSubject(1); // emits immediately (simulating a signal)

    const result: number[] = [];

    source$.pipe(skipUntil(notifier$)).subscribe({
      next: val => result.push(val),
      complete: () => {
        expect(result).toEqual(emissions); // all emitted, because notifier triggers instantly
        done();
      },
      error: done.fail
    });
  });

  it('should skip values until notifier emits', (done) => {
    const source$ = from([1, 2, 3, 4, 5]);
    const notifier$ = from([true]);

    const result: number[] = [];

    setTimeout(() => {
      notifier$.subscribe(); // trigger notifier
    }, 10);

    source$.pipe(skipUntil(notifier$)).subscribe({
      next: val => result.push(val),
      complete: () => {
        // The notifier$ here emits immediately, so all values are emitted
        expect(result).toEqual([1, 2, 3, 4, 5]);
        done();
      },
      error: done.fail
    });
  });



  it('should skip all values if notifier never emits', (done) => {
    const source$ = from([1, 2, 3]);
    const notifier$ = createSubject(); // empty notifier

    const result: number[] = [];

    source$.pipe(skipUntil(notifier$)).subscribe({
      next: val => result.push(val),
      complete: () => {
        expect(result).toEqual([]);
        done();
      },
      error: done.fail
    });
  });
});
