import { eachValueFrom, from, recurse, Stream } from '@actioncrew/streamix';

describe('recurse', () => {
  it('should recurse depth-first by default', async () => {
    const condition = (value: number) => value <= 3;
    const project = (value: number) => {
      return from(value < 3 ? [value + 1] : []);
    };

    const stream: Stream<number> = from([1]);

    const result: number[] = [];
    const outputStream = stream.pipe(recurse(condition, project));

    for await (const value of eachValueFrom(outputStream)) {
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3]); // Should traverse depth-first and process 1, 2, 3
  });

  it('should recurse breadth-first when specified', async () => {
    const condition = (value: number) => value <= 3;
    const project = (value: number) => {
      return from([value + 1]);
    };

    const stream: Stream<number> = from([1]);

    const result: number[] = [];
    const outputStream = stream.pipe(recurse(condition, project, { traversal: 'breadth' }));

    for await (const value of eachValueFrom(outputStream)) {
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3, 4]); // Should process in breadth-first order
  });

  it('should stop recursing beyond maxDepth', async () => {
    const condition = (value: number) => value <= 3;
    const project = (value: number) => {
      return from([value + 1]);
    };

    const stream: Stream<number> = from([1]);

    const result: number[] = [];
    const outputStream = stream.pipe(recurse(condition, project, { maxDepth: 2 }));

    for await (const value of eachValueFrom(outputStream)) {
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3]); // Should stop recursion at depth 2
  });

  it('should complete when no values remain to process', async () => {
    const condition = (value: number) => value <= 3;
    const project = (value: number) => {
      return from(value < 3 ? [value + 1] : []);
    };

    const stream: Stream<number> = from([1]);

    const result: number[] = [];
    const outputStream = stream.pipe(recurse(condition, project));

    for await (const value of eachValueFrom(outputStream)) {
      result.push(value);
    }

    expect(result).toEqual([1, 2, 3]);
  });

  it('should not recurse if condition is false', async () => {
    const condition = (value: number) => value <= 0;
    const project = (value: number) => {
      return from([value + 1]);
    };

    const stream: Stream<number> = from([1]);

    const result: number[] = [];
    const outputStream = stream.pipe(recurse(condition, project));

    for await (const value of eachValueFrom(outputStream)) {
      result.push(value);
    }

    expect(result).toEqual([1]); // Should not recurse beyond initial value because condition is false
  });
});
