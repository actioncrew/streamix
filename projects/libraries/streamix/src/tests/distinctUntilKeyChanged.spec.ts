import { createSubject, distinctUntilKeyChanged, eachValueFrom, Stream } from '../lib';

describe('distinctUntilKeyChanged operator', () => {
  let subject: ReturnType<typeof createSubject<any>>;
  let source: Stream<any>;

  beforeEach(() => {
    subject = createSubject<any>();
    source = subject;
  });

  it('should emit values with distinct keys', async () => {
    const distinctStream = source.pipe(distinctUntilKeyChanged('key'));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(distinctStream)) {
        results.push(value);
      }
    })();

    subject.next({ key: 1, value: 'a' });
    subject.next({ key: 1, value: 'b' }); // Same key, should not emit
    subject.next({ key: 2, value: 'c' }); // New key, should emit
    subject.next({ key: 2, value: 'd' }); // Same key, should not emit
    subject.next({ key: 3, value: 'e' }); // New key, should emit
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([
      { key: 1, value: 'a' },
      { key: 2, value: 'c' },
      { key: 3, value: 'e' },
    ]);
  });

  it('should emit the first value regardless of key', async () => {
    const distinctStream = source.pipe(distinctUntilKeyChanged('key'));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(distinctStream)) {
        results.push(value);
      }
    })();

    subject.next({ key: 1, value: 'a' });
    subject.next({ key: 1, value: 'b' }); // Same key, but first value, should emit
    subject.next({ key: 1, value: 'c' }); // Same key, should not emit
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([
      { key: 1, value: 'a' },
    ]);
  });

  it('should handle an empty stream gracefully', async () => {
    const distinctStream = source.pipe(distinctUntilKeyChanged('key'));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(distinctStream)) {
        results.push(value);
      }
    })();

    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([]); // No values emitted
  });

  it('should propagate errors from the source stream', async () => {
    const distinctStream = source.pipe(distinctUntilKeyChanged('key'));
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(distinctStream)) {
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
});
