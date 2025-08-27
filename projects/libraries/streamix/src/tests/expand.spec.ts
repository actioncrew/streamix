import { eachValueFrom, expand, from } from '@actioncrew/streamix';

describe('Expand Stream (RxJS-like)', () => {
  it('should handle errors thrown by the project function', async () => {
    const error = new Error('Project function error');
    const project = (value: number) => {
      if (value === 3) throw error;
      return from([value + 1]);
    };

    const stream = from([1]);
    const result: number[] = [];
    let caughtError: Error | undefined;

    try {
      for await (const value of eachValueFrom(stream.pipe(expand(project)))) {
        result.push(value);
      }
    } catch (e) {
      caughtError = e as Error;
    }

    expect(result).toEqual([1, 2]);
    expect(caughtError).toEqual(error);
  });

  it('should recursively expand (depth-first by default)', async () => {
    const project = (value: number) => {
      if (value >= 3) return from([]);
      return from([value + 1]);
    };

    const result: number[] = [];
    for await (const value of eachValueFrom(from([1]).pipe(expand(project)))) {
      result.push(value);
    }

    // Expected: 1, then 2 from 1, then 3 from 2
    expect(result).toEqual([1, 2, 3]);
  });

  it('should expand with breadth-first traversal', async () => {
    const project = (value: number) => {
      if (value >= 3) return from([]);
      return from([value + 1]);
    };

    const result: number[] = [];
    for await (const value of eachValueFrom(from([1]).pipe(expand(project, { traversal: 'breadth' })))) {
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3]);
  });

  it('should respect maxDepth and limit recursion', async () => {
    const project = (v: number) => from([v + 1]);

    const result: number[] = [];
    for await (const value of eachValueFrom(
      from([1]).pipe(expand(project, { maxDepth: 2 }))
    )) {
      result.push(value);
    }

    // Depth 0: 1 → Depth 1: 2 → Depth 2: 3
    expect(result).toEqual([1, 2, 3]);
  });

  it('should emit nothing if input is empty', async () => {
    const project = (v: number) => from([v + 1]);

    const result: number[] = [];
    for await (const value of eachValueFrom(
      from([]).pipe(expand(project))
    )) {
      result.push(value);
    }

    expect(result).toEqual([]);
  });

  it('should stop expanding when project returns an empty stream', async () => {
    const project = (value: number) => {
      if (value >= 5) return from([]);
      return from([value + 1]);
    };

    const result: number[] = [];
    for await (const value of eachValueFrom(from([1]).pipe(expand(project)))) {
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });
});
