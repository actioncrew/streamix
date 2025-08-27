import { createSubject, eachValueFrom, every, Stream } from '@actioncrew/streamix';

describe('every operator', () => {
  let subject: ReturnType<typeof createSubject<number>>;
  let source: Stream<number>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it('should emit true if all values satisfy the predicate', async () => {
    const predicate = (value: number) => value > 0;
    const everyStream = source.pipe(every(predicate));
    const results: boolean[] = [];

    (async () => {
      for await (const value of eachValueFrom(everyStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3); // All values > 0
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([true]);
  });

  it('should emit false if any value does not satisfy the predicate', async () => {
    const predicate = (value: number) => value > 0;
    const everyStream = source.pipe(every(predicate));
    const results: boolean[] = [];

    (async () => {
      for await (const value of eachValueFrom(everyStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(-1); // Does not satisfy predicate (value > 0)
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([false]);
  });

  it('should emit true if the stream is empty', async () => {
    const predicate = (value: number) => value > 0;
    const everyStream = source.pipe(every(predicate));
    const results: boolean[] = [];

    (async () => {
      for await (const value of eachValueFrom(everyStream)) {
        results.push(value);
      }
    })();

    subject.complete(); // Empty stream, so it should emit true
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([true]);
  });

  it('should propagate errors from the source stream', async () => {
    const predicate = (value: number) => value > 0;
    const everyStream = source.pipe(every(predicate));
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(everyStream)) {
          void _;
        }
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error('Test Error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error).toEqual(new Error('Test Error')); // Propagate error
  });

  it('should complete after emitting true when all values satisfy the predicate', async () => {
    const predicate = (value: number) => value > 0;
    const everyStream = source.pipe(every(predicate));
    let completed = false;

    (async () => {
      for await (const _ of eachValueFrom(everyStream)) {
        void _;
        completed = true;
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.complete(); // All values > 0, should emit true and complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(completed).toBe(true);
  });

  it('should complete after emitting false if any value does not satisfy the predicate', async () => {
    const predicate = (value: number) => value > 0;
    const everyStream = source.pipe(every(predicate));
    let completed = false;

    (async () => {
      for await (const _ of eachValueFrom(everyStream)) {
        void _;
        completed = true;
      }
    })();

    subject.next(1);
    subject.next(-1); // Does not satisfy predicate, should emit false and complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(completed).toBe(true);
  });
});
