import { delay, EMPTY, filter, from, map, mergeMap, take, timer } from '@actioncrew/streamix';

describe('mergeMap operator', () => {
  it('should merge emissions from inner streams correctly', (done) => {
    const testStream = from([1, 2, 3]);

    const project = (value: number) => from([value * 2, value * 4]);

    const mergedStream = testStream.pipe(mergeMap(project));

    let results: any[] = [];

    mergedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        results.sort((a, b) => a - b);
        expect(results).toEqual([2, 4, 4, 6, 8, 12]);
        done();
      }
    });
  });

  it('should correctly handle a chain of from, filter, mergeMap, filter, and mergeMap', (done) => {
    const testStream = from([1, 2, 3, 4, 5, 6]);

    // Project functions for mergeMap
    const firstProject = (value: number) => from([value, value * 10]);
    const secondProject = (value: number) => from([value * 2]);

    // Create the chained stream
    const chainedStream = testStream.pipe(
      // Filter: Keep only even numbers
      filter((value) => value % 2 === 0),
      // MergeMap: Project each even number into an array [value, value * 10]
      mergeMap(firstProject),
      // Filter: Keep values greater than 10
      filter((value) => value > 10),
      // MergeMap: Project each value into its double
      mergeMap(secondProject)
    );

    let results: number[] = [];
    let emissionCounter = 0; // Assume you're tracking emissions this way

    chainedStream.subscribe({
      next: (value) => {
        results.push(value);
        emissionCounter++; // Increment the counter for each emission
      },
      complete: () => {
        // Sort results for easier comparison
        results.sort((a, b) => a - b);

        // Validate the results
        expect(results).toEqual([40, 80, 120]);
        expect(emissionCounter).toBe(results.length); // Emission counter matches the number of emissions
        done();
      },
    });
  });

  it('should handle inner Observable that emits nothing', (done) => {
    const testStream = from([1, 2, 3]);

    const project = () => EMPTY; // Inner observable emits nothing

    const mergedStream = testStream.pipe(mergeMap(project));

    const results: number[] = [];

    mergedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // No emissions
        done();
      },
    });
  });

  it('should handle inner Observable that errors out', (done) => {
    const testStream = from([1, 2, 3]);

    const project = (value: number) => {
      if (value === 2) {
        throw new Error('Inner observable error');
      }
      return from([value * 2]);
    };

    const mergedStream = testStream.pipe(mergeMap(project));

    const results: number[] = [];

    mergedStream.subscribe({
      next: (value) => results.push(value),
      error: (err) => {
        expect(err.message).toBe('Inner observable error');
        done();
      },
    });
  });

  it('should merge inner Observable that emits multiple values', (done) => {
    const testStream = from([1, 2]);

    const project = (value: number) => from([value * 2, value * 3]);

    const mergedStream = testStream.pipe(mergeMap(project));

    const results: number[] = [];

    mergedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results.sort((a, b) => a - b)).toEqual([2, 3, 4, 6]); // Sorted results
        done();
      },
    });
  });

  it('should handle an empty source Observable', (done) => {
    const testStream = EMPTY;

    const project = (value: number) => from([value * 2]);

    const mergedStream = testStream.pipe(mergeMap(project));

    const results: number[] = [];

    mergedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([]); // No emissions
        done();
      },
    });
  });

  it('should handle rapid emissions from the source', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);

    const project = (value: number) =>
      from([value * 2]).pipe(delay(value * 10)); // Delay emissions based on value

    const mergedStream = testStream.pipe(mergeMap(project));

    const results: number[] = [];

    mergedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]); // Ordered by values processed
        done();
      },
    });
  });

  it('should wait for all inner Observables to complete', (done) => {
    const testStream = from([1, 2, 3]);

    const project = (value: number) => timer(value * 10).pipe(map(() => value * 2), take(1));

    const mergedStream = testStream.pipe(mergeMap(project));

    const results: number[] = [];

    mergedStream.subscribe({
      next: (value) => results.push(value),
      complete: () => {
        expect(results).toEqual([2, 4, 6]); // Inner streams complete in order
        done();
      },
    });
  });
});
