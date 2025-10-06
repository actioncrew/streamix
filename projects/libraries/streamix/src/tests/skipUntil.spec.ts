import { createBehaviorSubject, createSubject, from, skipUntil } from '@actioncrew/streamix';

describe('skipUntil', () => {
  it('should skip values before notifier emits and emit after that (Immediate Notifier)', async () => {
    const emissions = [1, 2, 3, 4, 5];
    const source$ = from(emissions);
    // Emits immediately, so the gate is open before source starts
    const notifier$ = createBehaviorSubject(true);

    const result: number[] = [];

    await new Promise<void>((resolve, reject) => {
      source$.pipe(skipUntil(notifier$)).subscribe({
        next: val => result.push(val),
        complete: () => {
          expect(result).toEqual(emissions); // All values should pass through
          resolve();
        },
        error: reject
      });
    });
  });

  it('should skip values until notifier emits (Immediate `from` Notifier)', async () => {
    const source$ = from([1, 2, 3, 4, 5]);
    // `from` array emits immediately and completes
    const notifier$ = from([true]);

    const result: number[] = [];

    await new Promise<void>((resolve, reject) => {
      source$.pipe(skipUntil(notifier$)).subscribe({
        next: val => result.push(val),
        complete: () => {
          // Since the source is synchronous and the notifier is created immediately, 
          // the notifier fires before or concurrently with the source's first value.
          expect(result).toEqual([1, 2, 3, 4, 5]);
          resolve();
        },
        error: reject
      });
    });
  });

  it('should skip all values if notifier never emits', async () => {
    const source$ = from([1, 2, 3]);
    // Notifier never emits, so the gate remains closed
    const notifier$ = createSubject();

    const result: number[] = [];

    await new Promise<void>((resolve, reject) => {
      source$.pipe(skipUntil(notifier$)).subscribe({
        next: val => result.push(val),
        complete: () => {
          expect(result).toEqual([]);
          resolve();
        },
        error: reject
      });
    });
  });
  
  it('should skip initial values and then emit the rest after notifier delay', async () => {
    const source$ = createSubject<number>();
    const notifier$ = createSubject<boolean>();
    const result: number[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      source$.pipe(skipUntil(notifier$)).subscribe({
        next: val => result.push(val),
        complete: () => {
          expect(result).toEqual([4, 5]); // Should skip 1, 2, 3
          resolve();
        },
        error: reject
      });
    });

    // 1. Values to be skipped
    source$.next(1);
    source$.next(2);
    source$.next(3);

    // 2. Notifier emits, allowing subsequent emissions
    notifier$.next(true);

    // 3. Values to be emitted
    source$.next(4);
    source$.next(5);

    // 4. Complete the stream
    source$.complete();
    notifier$.complete();

    await promise;
  });

  it('should stop skipping when notifier completes without emitting (should continue skipping)', async () => {
    const source$ = createSubject<number>();
    const notifier$ = createSubject<boolean>();
    const result: number[] = [];

    const promise = new Promise<void>((resolve, reject) => {
      source$.pipe(skipUntil(notifier$)).subscribe({
        next: val => result.push(val),
        complete: () => {
          expect(result).toEqual([]); // All values should be skipped
          resolve();
        },
        error: reject
      });
    });

    // Values that should be skipped
    source$.next(1);
    source$.next(2);

    // Notifier completes without emitting (gate remains closed)
    notifier$.complete();

    // Subsequent values should still be skipped
    source$.next(3);
    source$.next(4);

    source$.complete();
    await promise;
  });

  it('should propagate an error from the source stream immediately', async () => {
    const source$ = createSubject<number>();
    const notifier$ = createSubject<boolean>();
    const expectedError = new Error('Source failed');

    const promise = new Promise<void>((resolve, reject) => {
      source$.pipe(skipUntil(notifier$)).subscribe({
        next: () => reject(new Error('Value was incorrectly emitted')), // Should not emit
        complete: () => reject(new Error('Stream completed unexpectedly')), // Should not complete
        error: (err) => {
          expect(err).toBe(expectedError);
          resolve(); // Resolve on expected error
        }
      });
    });

    source$.next(1); // Skipped
    source$.error(expectedError); // Error should propagate
    notifier$.next(true); // Ignored

    await promise;
  });

  it('should propagate an error from the notifier stream immediately', async () => {
    const source$ = createSubject<number>();
    const notifier$ = createSubject<boolean>();
    const expectedError = new Error('Notifier failed');

    const promise = new Promise<void>((resolve, reject) => {
      source$.pipe(skipUntil(notifier$)).subscribe({
        next: () => reject(new Error('Value was incorrectly emitted')), // Should not emit
        complete: () => reject(new Error('Stream completed unexpectedly')), // Should not complete
        error: (err) => {
          expect(err).toBe(expectedError);
          resolve(); // Resolve on expected error
        }
      });
    });

    source$.next(1); // Skipped
    notifier$.error(expectedError); // Notifier error should propagate

    // Subsequent source value and completion should be ignored
    source$.next(2);
    source$.complete();

    await promise;
  });
});