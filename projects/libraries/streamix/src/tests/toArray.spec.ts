import { createSubject, eachValueFrom, Stream, toArray } from '@actioncrew/streamix';

describe('toArray operator', () => {
  let subject: ReturnType<typeof createSubject<number>>;
  let source: Stream<number>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it('should collect all values and emit them as an array when the stream completes', async () => {
    const toArrayStream = source.pipe(toArray());
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(toArrayStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[1, 2, 3]]);
  });

  it('should emit an empty array when the stream completes without emitting any values', async () => {
    const toArrayStream = source.pipe(toArray());
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(toArrayStream)) {
        results.push(value);
      }
    })();

    subject.complete(); // No values emitted, just completing
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[]]); // Empty array
  });

  it('should propagate errors from the source stream', async () => {
    const toArrayStream = source.pipe(toArray());
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(toArrayStream)) {
          void _;
        }
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error('Test Error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error).toEqual(new Error('Test Error'));  // Propagate error
  });

  it('should handle the stream completing after emitting values', async () => {
    const toArrayStream = source.pipe(toArray());
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(toArrayStream)) {
        results.push(value);
      }
    })();

    subject.next(10);
    subject.next(20);
    subject.next(30);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[10, 20, 30]]);
  });

  it('should handle an edge case where only one value is emitted', async () => {
    const toArrayStream = source.pipe(toArray());
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(toArrayStream)) {
        results.push(value);
      }
    })();

    subject.next(42); // Single value
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[42]]);  // Single value in array
  });
});
