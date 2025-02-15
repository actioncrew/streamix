import { from, Group, groupBy, map, merge, mergeMap, tap, toArray } from '../lib';

describe('groupBy and custom partitioning', () => {
  it('should partition values using groupBy and sort them by key', (done) => {
    let result: any[] = [];
    const groupsMap = new Map<string, any[]>(); // Store latest group values

    from([1, 2, 3, 4, 5, 6]).pipe(
      groupBy((value: number) => (value % 2 === 0 ? 'even' : 'odd'))
    ).subscribe({
      next: (group) => {
        groupsMap.set(group.key, group.values); // Update the latest group
      },
      complete: () => {
        // Ensure 'odd' group comes first
        const sortedGroups = ['odd', 'even'].flatMap((key) => groupsMap.get(key) ?? []);

        result = sortedGroups;
        expect(result).toEqual([1, 3, 5, 2, 4, 6]); // Odd numbers first, then even
        done();
      },
    });
  });

  it('should apply custom operators for each partition and collect results', (done) => {
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
    const groupsMap = new Map<string, any[]>(); // Store latest group values

    // Use mergeMap to combine all partitioned streams into one observable
    const source$ = merge(...partitionedStreams).pipe(
      groupBy((value: string) => value.startsWith('Low') ? 'low' : 'high'),
      mergeMap((group: Group<string, "low" | "high">) => {
        const key = group.key; // Get the group key ('low' or 'high')
        const operators = paths[key] || []; // Get the operators for this group
        groupsMap.set(key, []);

        return from(group.values).pipe(
          ...operators,
          toArray(),
          tap(values => groupsMap.set(key, values))
        );
      })
    );

    source$.subscribe({
      complete: () => {
        const sortedGroups = Array.from(groupsMap.entries()).sort(([keyA], []) => {
          return keyA === 'low' ? -1 : 1; // Sort 'low' before 'high'
        });

        result = sortedGroups.flatMap(([_, group]) => group);

        // Expect processed values with the custom operator applied
        expect(result).toEqual([
          'Processed Low: 1', 'Processed Low: 2', 'Processed Low: 3',
          'Processed High: 10', 'Processed High: 20', 'Processed High: 30',
        ]);
        done(); // Ensure done() is called after the assertions
      },
    });
  });

  it('should handle partitioning and splitting with custom operators together', (done) => {
    let result: any[] = [];

    // Partition and split values into "low" and "high" ranges
    const paths = {
      low: [map((value: number) => (value <= 5 ? 'low' : 'high'))],
      high: [map((value: number) => (value > 5 ? 'high' : 'low'))],
    };

    const groupsMap = new Map<string, any[]>();

    // Create partitioned stream and apply operators
    const source$ = from([1, 3, 5, 7, 10]).pipe(
      groupBy((value: number) => (value <= 5 ? 'low' : 'high')),
      mergeMap((group: Group<string, "low" | "high">) => {
        const key = group.key; // Get the group key ('low' or 'high')
        const operators = paths[key] || []; // Get the operators for this group

        groupsMap.set(key, []);

        return from(group.values).pipe(
          ...operators,
          toArray(),
          tap(values => groupsMap.set(key, values))
        );
      })
    );

    source$.subscribe({
      complete: () => {
        const sortedGroups = Array.from(groupsMap.entries()).sort(([keyA], []) => {
          return keyA === 'low' ? -1 : 1; // Sort 'low' before 'high'
        });

        result = sortedGroups.flatMap(([_, group]) => group);

        // Expect processed values with the custom operator applied
        expect(result).toEqual(['low', 'low', 'low', 'high', 'high']);
        done(); // Ensure done() is called after the assertions
      },
    });
  });
});
