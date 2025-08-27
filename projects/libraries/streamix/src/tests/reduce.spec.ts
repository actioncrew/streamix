import { createSubject, eachValueFrom, reduce, Stream } from '@actioncrew/streamix';

describe('reduce operator', () => {
  let subject: ReturnType<typeof createSubject<number>>;
  let source: Stream<number>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it('should accumulate values from the source stream', async () => {
    const accumulatedStream = source.pipe(reduce((acc, value) => acc + value, 0));  // Sum values
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(accumulatedStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([6]);  // 1 + 2 + 3 = 6
  });

  it('should emit the seed value if the stream is empty', async () => {
    const accumulatedStream = source.pipe(reduce((acc, value) => acc + value, 0));  // Sum values
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(accumulatedStream)) {
        results.push(value);
      }
    })();

    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([0]);  // Seed value should be emitted
  });

  it('should propagate errors from the source stream', async () => {
    const accumulatedStream = source.pipe(reduce((acc, value) => acc + value, 0));  // Sum values
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(accumulatedStream)) {
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

  it('should emit the accumulated value when stream completes', async () => {
    const accumulatedStream = source.pipe(reduce((acc, value) => acc * value, 1));  // Product of values
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(accumulatedStream)) {
        results.push(value);
      }
    })();

    subject.next(2);
    subject.next(3);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([6]);  // 1 * 2 * 3 = 6
  });

  it('should work with non-numeric accumulators', async () => {
    let subject = createSubject<string>();

    const accumulatedStream = subject.pipe(reduce((acc, value) => acc + value, ''));  // Concatenate strings
    const results: string[] = [];

    (async () => {
      for await (const value of eachValueFrom(accumulatedStream)) {
        results.push(value);
      }
    })();

    subject.next('Hello');
    subject.next(' ');
    subject.next('World');
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual(['Hello World']);
  });

  it('should handle edge case where accumulator always returns the same value', async () => {
    let subject = createSubject<string>();
    const accumulatedStream = subject.pipe(reduce(() => 'constant', 'initial'));  // Always return 'constant'
    const results: string[] = [];

    (async () => {
      for await (const value of eachValueFrom(accumulatedStream)) {
        results.push(value);
      }
    })();

    subject.next('A');
    subject.next('B');
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual(['constant']);  // The accumulator always returns 'constant'
  });
});
