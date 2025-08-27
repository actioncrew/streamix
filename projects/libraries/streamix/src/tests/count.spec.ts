import { count, createSubject, eachValueFrom, max, min, Stream } from '@actioncrew/streamix';

describe('min operator', () => {
  let subject: ReturnType<typeof createSubject<number>>;
  let source: Stream<number>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it('should emit the smallest value', async () => {
    const minStream = source.pipe(min());
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(minStream)) {
        results.push(value);
      }
    })();

    subject.next(3);
    subject.next(1); // Smallest value
    subject.next(2);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1]);
  });

  it('should propagate errors from the source stream', async () => {
    const minStream = source.pipe(min());
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(minStream)) {}
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error('Test Error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error).toEqual(new Error('Test Error'));
  });
});

describe('max operator', () => {
  let subject: ReturnType<typeof createSubject<number>>;
  let source: Stream<number>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it('should emit the largest value', async () => {
    const maxStream = source.pipe(max());
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(maxStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(3); // Largest value
    subject.next(2);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([3]);
  });

  it('should propagate errors from the source stream', async () => {
    const maxStream = source.pipe(max());
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(maxStream)) {}
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error('Test Error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error).toEqual(new Error('Test Error'));
  });
});

describe('count operator', () => {
  let subject: ReturnType<typeof createSubject<number>>;
  let source: Stream<number>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it('should emit the count of values', async () => {
    const countStream = source.pipe(count());
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(countStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([3]); // 3 values emitted
  });

  it('should emit 0 for an empty stream', async () => {
    const countStream = source.pipe(count());
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(countStream)) {
        results.push(value);
      }
    })();

    subject.complete(); // No values, should emit 0
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([0]);
  });

  it('should propagate errors from the source stream', async () => {
    const countStream = source.pipe(count());
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(countStream)) {}
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error('Test Error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error).toEqual(new Error('Test Error'));
  });
});
