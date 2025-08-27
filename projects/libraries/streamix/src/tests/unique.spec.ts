import { createSubject, eachValueFrom, Stream, unique } from '@actioncrew/streamix';

describe('unique operator', () => {
  let subject: ReturnType<typeof createSubject<any>>;
  let source: Stream<any>;

  beforeEach(() => {
    subject = createSubject<any>();
    source = subject;
  });

  it('should emit only unique values', async () => {
    const uniqueStream = source.pipe(unique());
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(uniqueStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(2); // Duplicate, should not emit
    subject.next(3);
    subject.next(1); // Duplicate, should not emit
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1, 2, 3]);
  });

  it('should emit unique values based on the keySelector', async () => {
    const uniqueStream = source.pipe(unique(value => value.key));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(uniqueStream)) {
        results.push(value);
      }
    })();

    subject.next({ key: 1, value: 'a' });
    subject.next({ key: 2, value: 'b' });
    subject.next({ key: 1, value: 'c' }); // Same key, should not emit
    subject.next({ key: 3, value: 'd' });
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([
      { key: 1, value: 'a' },
      { key: 2, value: 'b' },
      { key: 3, value: 'd' },
    ]);
  });

  it('should emit all values when no key selector is provided', async () => {
    const uniqueStream = source.pipe(unique());
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(uniqueStream)) {
        results.push(value);
      }
    })();

    subject.next({ value: 'a' });
    subject.next({ value: 'a' }); // Duplicate, should not emit
    subject.next({ value: 'b' });
    subject.next({ value: 'c' });
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([
      { value: 'a' },
      { value: 'a' },
      { value: 'b' },
      { value: 'c' },
    ]);
  });

  it('should handle an empty stream gracefully', async () => {
    const uniqueStream = source.pipe(unique());
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(uniqueStream)) {
        results.push(value);
      }
    })();

    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([]); // No values emitted
  });

  it('should propagate errors from the source stream', async () => {
    const uniqueStream = source.pipe(unique());
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(uniqueStream)) {
          void _;
        }
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error('Test Error'));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error).toEqual(new Error('Test Error'));
  });

  it('should handle complex objects correctly', async () => {
    const uniqueStream = source.pipe(unique(value => value.id));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(uniqueStream)) {
        results.push(value);
      }
    })();

    subject.next({ id: 1, name: 'John' });
    subject.next({ id: 2, name: 'Jane' });
    subject.next({ id: 1, name: 'John' }); // Duplicate, should not emit
    subject.next({ id: 3, name: 'Jake' });
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
      { id: 3, name: 'Jake' },
    ]);
  });
});
