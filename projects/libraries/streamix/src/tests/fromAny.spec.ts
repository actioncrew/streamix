import { createStream, fromAny } from "@actioncrew/streamix";

describe('fromAny', () => {
  it('should return the same stream if input is already a Stream', (done) => {
    const originalStream = createStream('test', async function* () {
      yield 42;
    });

    const result = fromAny(originalStream);

    expect(result).toBe(originalStream);

    const values: number[] = [];
    result.subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual([42]);
        done();
      },
    });
  });

  it('should wrap a synchronous value into a stream', (done) => {
    const result = fromAny(99);

    const values: number[] = [];
    result.subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual([99]);
        done();
      },
    });
  });

  it('should wrap a promise into a stream', (done) => {
    const promise = Promise.resolve('hello');
    const result = fromAny(promise);

    const values: string[] = [];
    result.subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual(['hello']);
        done();
      },
    });
  });

  it('should convert an array into a stream', (done) => {
    const arr = [1, 2, 3];
    const result = fromAny(arr);

    const values: number[] = [];
    result.subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual([1, 2, 3]);
        done();
      },
    });
  });

  it('should handle an empty array', (done) => {
    const arr: number[] = [];
    const result = fromAny(arr);

    const values: number[] = [];
    result.subscribe({
      next: (v) => values.push(v),
      complete: () => {
        expect(values).toEqual([]);
        done();
      },
    });
  });
});
