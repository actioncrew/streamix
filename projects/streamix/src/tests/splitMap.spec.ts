import { createEmission, createOperator, from, map, merge } from '../lib';
import { partitionBy, splitMap } from '../lib';

describe('partitionBy and splitMap operators', () => {
  let source$: any;

  beforeEach(() => {
    // Setup streams for testing
  });

  it('should partition values using partitionBy', (done) => {
    let result: any[] = [];

    // Create a stream that partitions numbers into "even" and "odd" groups
    const partitionOperator = partitionBy((value: number) => (value % 2 === 0 ? 'even' : 'odd'));

    source$ = from([1, 2, 3, 4, 5, 6]).pipe(partitionOperator);

    source$.subscribe({
      next: (value: any) => { result = Array.from(value.values()).flat(); },
      complete: () => {
        expect(result).toEqual([ 1, 3, 5, 2, 4, 6]);  // odd numbers first, followed by even
        done();
      },
    });
  });

  it('should apply custom operators for each partition', (done) => {
    let result: any[] = [];

    const customOperator = map(value =>`Processed ${value}`);

    const paths = {
      low: [customOperator],
      high: [customOperator],
    };

    // Partitioned streams
    const lowPartition = from([1, 2, 3]).pipe(map((value) => `Low: ${value}`));
    const highPartition = from([10, 20, 30]).pipe(map((value) => `High: ${value}`));

    const partitionedStreams = [lowPartition, highPartition];

    // Use merge to combine all partitioned streams into one observable
    const source$ = merge(...partitionedStreams).pipe(
      partitionBy((value: string) => value.startsWith('Low') ? 'low' : 'high'),
      splitMap(paths)  // Apply splitMap with custom operators
    );

    source$.subscribe({
      next: (value) => result.push(value),
      complete: () => {
        // Expect processed values with the custom operator applied
        expect(result).toEqual([
          'Processed Low: 1', 'Processed Low: 2', 'Processed Low: 3',
          'Processed High: 10', 'Processed High: 20', 'Processed High: 30',
        ]);
        done();
      },
    });
  });

  it('should handle both operators together for partitioning and splitting', (done) => {
    const result: string[] = [];

    // Partition and split values into "low" and "high" ranges
    const paths = {
      low: [map((value: number) => (value <= 5 ? 'low' : 'high'))],
      high: [map((value: number) => (value > 5 ? 'high' : 'low'))],
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
});
