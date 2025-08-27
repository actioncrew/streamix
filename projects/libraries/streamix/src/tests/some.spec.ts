import { createSubject, eachValueFrom, some, Stream } from '@actioncrew/streamix';

describe('some operator', () => {
  let subject: ReturnType<typeof createSubject<number>>;
  let source: Stream<number>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it('should emit true if any value matches the predicate', async () => {
    const predicate = (value: number) => value > 2;
    const someStream = source.pipe(some(predicate));
    const results: boolean[] = [];

    (async () => {
      for await (const value of eachValueFrom(someStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3); // Satisfies predicate (value > 2)
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([true]);
  });

  it('should emit false if no value matches the predicate', async () => {
    const predicate = (value: number) => value > 5;
    const someStream = source.pipe(some(predicate));
    const results: boolean[] = [];

    (async () => {
      for await (const value of eachValueFrom(someStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.complete(); // No value satisfies predicate (value > 5)
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([false]);
  });

  it('should emit false if the stream is empty', async () => {
    const predicate = (value: number) => value > 2;
    const someStream = source.pipe(some(predicate));
    const results: boolean[] = [];

    (async () => {
      for await (const value of eachValueFrom(someStream)) {
        results.push(value);
      }
    })();

    subject.complete(); // No values, so should emit false
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([false]);
  });

  it('should propagate errors from the source stream', async () => {
    const predicate = (value: number) => value > 2;
    const someStream = source.pipe(some(predicate));
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(someStream)) {}
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error('Test Error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error).toEqual(new Error('Test Error')); // Propagate error
  });

  it('should complete after emitting true when predicate is matched', async () => {
    const predicate = (value: number) => value > 2;
    const someStream = source.pipe(some(predicate));
    let completed = false;

    (async () => {
      for await (const _ of eachValueFrom(someStream)) {
        completed = true;
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3); // Satisfies predicate, should emit true and complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(completed).toBe(true);
  });

  it('should complete after emitting false if no value matches the predicate', async () => {
    const predicate = (value: number) => value > 5;
    const someStream = source.pipe(some(predicate));
    let completed = false;

    (async () => {
      for await (const _ of eachValueFrom(someStream)) {
        completed = true;
      }
    })();

    subject.next(1);
    subject.next(2); // No value satisfies predicate, should emit false and complete
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(completed).toBe(true);
  });
});
