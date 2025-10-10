import { filter, from } from '@actioncrew/streamix';

describe('filter', () => {
  it('should allow values that pass the predicate', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const predicate = (value: number) => value % 2 === 0;

    const filteredStream = testStream.pipe(filter(predicate));

    filteredStream.subscribe({
      next: (value) => {
        expect(value).toBeGreaterThanOrEqual(2);
      },
      complete: () => {
        done();
      },
      error: done.fail,
    });
  });

  it('should not emit values that fail the predicate', (done) => {
    const testStream = from([1, 2, 3]);
    const predicate = (value: number) => value > 3;

    const filteredStream = testStream.pipe(filter(predicate));
    let emittedCount = 0;

    filteredStream.subscribe({
      next: (value) => {
        emittedCount++;
        fail(`Unexpected value emitted: ${value}`);
      },
      complete: () => {
        expect(emittedCount).toBe(0); // ✅ Add expectation
        done();
      },
      error: done.fail,
    });
  });

  it('should emit all allowed values before stopping', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const predicate = (value: number) => value <= 3;

    let count = 0;

    const filteredStream = testStream.pipe(filter(predicate));

    filteredStream.subscribe({
      next: () => count++,
      complete: () => {
        expect(count).toBe(3);
        done();
      },
      error: done.fail,
    });
  });
});
