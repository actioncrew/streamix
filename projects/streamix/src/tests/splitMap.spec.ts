import { from } from '../lib';
import { partitionBy, splitMap } from '../lib';

describe('partitionBy and splitMap operators', () => {
  let source$: any;
  let partitionedStream$: any;

  beforeEach(() => {
    // Setup streams for testing
  });

  it('should partition values using partitionBy', (done) => {
    const result: string[] = [];

    // Create a stream that partitions numbers into "even" and "odd" groups
    const partitionOperator = partitionBy((value: number) => (value % 2 === 0 ? 'even' : 'odd'));

    source$ = from([1, 2, 3, 4, 5, 6]).pipe(partitionOperator);

    source$.subscribe({
      next: (value: any) => console.log(value),
      complete: () => {
        expect(result).toEqual([2, 4, 6, 1, 3, 5]);  // Even numbers first, followed by odd
        done();
      },
    });
  });

  it('should use splitMap to handle partitioned values', (done) => {
    const result: string[] = [];

    // Create a partition map with "even" and "odd" as keys
    const paths = {
      even: [partitionBy((value: number) => 'even')],
      odd: [partitionBy((value: number) => 'odd')],
    };

    // Create a partitioned stream with values "even" and "odd" from the `partitionBy` operator
    const splitMapOperator = splitMap(paths);

    // Partition numbers into "even" and "odd"
    source$ = from([1, 2, 3, 4, 5, 6]).pipe(partitionBy((value: number) => (value % 2 === 0 ? 'even' : 'odd')), splitMapOperator);

    source$.subscribe({
      next: (value: any) => result.push(value),
      complete: () => {
        expect(result).toEqual(['even', 'even', 'even', 'odd', 'odd', 'odd']);
        done();
      },
    });
  });

  it('should handle both operators together for partitioning and splitting', (done) => {
    const result: string[] = [];

    // Partition and split values into "low" and "high" ranges
    const paths = {
      low: [partitionBy((value: number) => (value <= 5 ? 'low' : 'high'))],
      high: [partitionBy((value: number) => (value > 5 ? 'high' : 'low'))],
    };

    // Create partitioned stream and apply operators
    source$ = from([1, 3, 5, 7, 10]).pipe(
      partitionBy((value: number) => (value <= 5 ? 'low' : 'high')),
      splitMap(paths)
    );

    source$.subscribe({
      next: (value: any) => result.push(value),
      complete: () => {
        expect(result).toEqual(['low', 'low', 'low', 'high', 'high']); // Correctly split into "low" and "high"
        done();
      },
    });
  });

  it('should warn if a partition is missing a handler in splitMap', (done) => {
    const result: string[] = [];

    // Create partition map with missing handlers
    const paths = {
      low: [partitionBy((value: number) => 'low')],  // No handler for 'high'
    };

    const splitMapOperator = splitMap(paths);
    source$ = from([1, 3, 5, 7, 10]).pipe(partitionBy((value: number) => (value <= 5 ? 'low' : 'high')), splitMapOperator);

    // We expect a warning since there's no handler for the "high" partition
    spyOn(console, 'warn'); // Spy on console.warn to catch any warnings

    source$.subscribe({
      next: (value: any) => result.push(value),
      complete: () => {
        expect(result).toEqual(['low', 'low', 'low']);  // Only the "low" values should be processed
        expect(console.warn).toHaveBeenCalledWith('No handlers found for partition key: high');
        done();
      },
    });
  });

  it('should handle the case where no partitions match in splitMap', (done) => {
    const result: string[] = [];

    // Create a partition map that doesn't handle the partition key
    const paths = {
      low: [partitionBy((value: number) => 'low')],
    };

    const splitMapOperator = splitMap(paths);
    source$ = from([1, 2, 3, 4]).pipe(partitionBy((value: number) => 'high'), splitMapOperator);

    // We expect a warning since the partition key "high" doesn't have a handler
    spyOn(console, 'warn'); // Spy on console.warn to catch any warnings

    source$.subscribe({
      next: (value: any) => result.push(value),
      complete: () => {
        expect(result).toEqual([]);  // No emissions for "high" partition since there's no handler
        expect(console.warn).toHaveBeenCalledWith('No handlers found for partition key: high');
        done();
      },
    });
  });
});
