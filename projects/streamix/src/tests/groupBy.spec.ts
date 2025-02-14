import { from, groupBy, map, mergeMap, merge, toArray } from '../lib';

describe('groupBy and custom partitioning', () => {
  let source$: any;

  beforeEach(() => {
    // Setup streams for testing
  });

  it('should partition values using groupBy', (done) => {
    let result: any[] = [];

    // Create a stream that partitions numbers into "even" and "odd" groups
    const partitionOperator = groupBy((value: number) => (value % 2 === 0 ? 'even' : 'odd'));

    const source$ = from([1, 2, 3, 4, 5, 6]).pipe(
      partitionOperator,
      mergeMap(group$ =>
        group$.pipe(
          toArray(), // Collect the values in each group
          map(groupValues => ({
            key: group$.key, // Keep the key for sorting later
            values: groupValues,
          }))
        )
      ),
      toArray() // Collect all groups at once
    );

    source$.subscribe({
      next: (groups) => {
        // Sort groups by their key (odd first, then even)
        const sortedGroups = groups.sort((a, b) => (a.key === 'odd' ? -1 : 1));
        result = sortedGroups.flatMap(group => group.values);
      },
      complete: () => {
        // Assert that the result contains odd numbers first, followed by even numbers
        expect(result).toEqual([1, 3, 5, 2, 4, 6]); 
        done();
      },
    });
  });
  
  it('should apply custom operators for each partition', (done) => {
    let result: any[] = [];

    const customOperator = map((value: any) => `Processed ${value}`);

    const paths = {
      low: [customOperator],
      high: [customOperator],
    };

    // Partitioned streams
    const lowPartition = from([1, 2, 3]).pipe(map((value) => `Low: ${value}`));
    const highPartition = from([10, 20, 30]).pipe(map((value) => `High: ${value}`));

    const partitionedStreams = [lowPartition, highPartition];

    // Use mergeMap to combine all partitioned streams into one observable
    const source$ = merge(...partitionedStreams).pipe(
      groupBy((value: string) => value.startsWith('Low') ? 'low' : 'high'),
      mergeMap((group$) => {
        const key = group$.key; // Get the group key ('low' or 'high')
        const operators = paths[key] || []; // Get the operators for this group
        return group$.pipe(
          ...operators,
          toArray(), // Collect all values in the group to make sure they are emitted fully
          map(groupValues => ({
            key,
            values: groupValues
          }))
        );
      }),
      toArray() // Collect all groups together
    );

    source$.subscribe({
      next: (groups) => {
        // Sort groups by their key (low first, then high)
        const sortedGroups = groups.sort((a, b) => (a.key === 'low' ? -1 : 1));
        result = sortedGroups.flatMap(group => group.values);
      },
      complete: () => {
        // Expect processed values with the custom operator applied
        expect(result).toEqual([
          'Processed Low: 1', 'Processed Low: 2', 'Processed Low: 3',
          'Processed High: 10', 'Processed High: 20', 'Processed High: 30',
        ]);
        done(); // Ensure done() is called after the assertions
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
    const source$ = from([1, 3, 5, 7, 10]).pipe(
      groupBy((value: number) => (value <= 5 ? 'low' : 'high')),
      mergeMap((group$) => {
        const key = group$.key; // Get the group key ('low' or 'high')
        const operators = paths[key] || []; // Get the operators for this group
        return group$.pipe(
          ...operators,
          toArray(), // Collect all values in the group to make sure they are emitted fully
          map(groupValues => ({
            key,
            values: groupValues
          }))
        );
      }),
      toArray() // Collect all groups together
    );

    source$.subscribe({
      next: (groups) => {
        // Sort groups by their key (low first, then high)
        const sortedGroups = groups.sort((a, b) => (a.key === 'low' ? -1 : 1));
        result = sortedGroups.flatMap(group => group.values);
      },
      complete: () => {
        // Expect processed values with the custom operator applied
        expect(result).toEqual(['low', 'low', 'low', 'high', 'high']);
        done(); // Ensure done() is called after the assertions
      },
    });
  });
});
