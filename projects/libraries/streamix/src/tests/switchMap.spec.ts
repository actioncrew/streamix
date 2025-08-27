import { createSubject, delay, EMPTY, from, switchMap } from '@actioncrew/streamix';

describe('switchMap operator', () => {
  it('should switch to new inner streams correctly', (done) => {
    const testStream = from([1, 2, 3]).pipe(delay(100));
    const project = (value: number) => from([value * 10, value * 100]);

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    switchedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([10, 100, 20, 200, 30, 300]); // Should switch to new inner streams and emit all values
        done();
      }
    });
  });

  it('should cancel previous inner stream emissions when a new emission arrives', (done) => {
    const testStream = from([1, 2, 3]);

    const project = (value: number) => {
      const innerStream = createSubject();
      setTimeout(() => innerStream.next(value * 10), 50);   // Emit 10
      setTimeout(() => innerStream.next(value * 100), 150); // Emit 100
      setTimeout(() => innerStream.complete(), 500);        // Complete inner stream
      return innerStream;
    };

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    const subscription = switchedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([30, 300]);
        subscription.unsubscribe();
        done();
      }
    });
  });

  it('should handle switching to an empty observable', (done) => {
    const testStream = from([1, 2, 3]);
    const project = () => {
      const innerStream = createSubject();
      innerStream.complete(); // No emissions, just complete immediately
      return innerStream;
    };

    const switchedStream = testStream.pipe(switchMap(project));

    const results: any[] = [];

    switchedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // No values should be emitted
        done();
      }
    });
  });

  it('should switch to an inner observable that delays emissions', (done) => {
    const testStream = from([1, 2]);
    const project = (value: number) => {
      const innerStream = createSubject();
      setTimeout(() => innerStream.next(value * 10), 100);
      setTimeout(() => innerStream.complete(), 300);
      return innerStream;
    };

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];

    switchedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([20]); // Should emit after delay and complete
        done();
      }
    });
  });

  it('should propagate errors from inner observables', (done) => {
    const testStream = from([1, 2, 3]);
    const project = (value: number) => {
      const innerStream = createSubject();
      if (value === 2) {
        throw new Error('Inner Error');
      } else {
        setTimeout(() => innerStream.next(value * 10), 50);
        setTimeout(() => innerStream.complete(), 200);
      }
      return innerStream;
    };

    const switchedStream = testStream.pipe(switchMap(project));

    let results: any[] = [];
    let errorOccurred = false;

    switchedStream.subscribe({
      next: (value) => results.push(value),
      error: (err) => {
        errorOccurred = true;
        expect(err.message).toBe('Inner Error');
        expect(results).toEqual([]); // Only the first emission should succeed
        done();
      },
      complete: () => {
        expect(errorOccurred).toBe(true);
      }
    });
  });

  it('should not emit anything for an empty source observable', (done) => {
    const testStream = EMPTY;

    const project = (value: number) => {
      const innerStream = createSubject();
      innerStream.next(value * 10);
      innerStream.complete();
      return innerStream;
    };

    const switchedStream = testStream.pipe(switchMap(project));

    const results: any[] = [];

    switchedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // No values should be emitted
        done();
      }
    });
  });
});
