import { createBehaviorSubject, createBehaviorSubjectBuffer } from '@actioncrew/streamix';

describe('createBehaviorSubject', () => {
  it('should emit the current value to new subscribers immediately', (done) => {
    const initialValue = 'initial_value';
    const behaviorSubject = createBehaviorSubject(initialValue);

    const emittedValues: string[] = [];

    behaviorSubject.subscribe({
      next: (value: string) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([initialValue, 'value1', 'value2']);
        done();
      }
    });

    behaviorSubject.next('value1');
    behaviorSubject.next('value2');
    behaviorSubject.complete();
  });

  it('should always expose the latest value via the snappy getter', () => {
    const initial = 42;
    const behaviorSubject = createBehaviorSubject(initial);

    expect(behaviorSubject.snappy).toBe(42);

    behaviorSubject.next(100);
    expect(behaviorSubject.snappy).toBe(100);

    behaviorSubject.next(999);
    expect(behaviorSubject.snappy).toBe(999);

    behaviorSubject.complete();
    expect(behaviorSubject.snappy).toBe(999);
  });

  it('should allow multiple subscribers to receive the same latest value', async () => {
    const subject = createBehaviorSubject<number>(0);

    const valuesA: number[] = [];
    const valuesB: number[] = [];

    subject.subscribe(v => valuesA.push(v));
    subject.subscribe(v => valuesB.push(v));

    subject.next(1);
    subject.next(2);

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(valuesA).toEqual([0, 1, 2]);
    expect(valuesB).toEqual([0, 1, 2]);
  });

  it('should not emit values after completion', async () => {
    const subject = createBehaviorSubject<string>('init');

    const values: string[] = [];
    subject.subscribe(v => values.push(v));

    subject.next('a');
    subject.complete();
    subject.next('b'); // should be ignored

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(values).toEqual(['init', 'a']);
  });

  it('should allow late subscribers to still receive the last value', async () => {
    const subject = createBehaviorSubject<number>(123);

    subject.next(456);

    // Wait for the next to process
    await new Promise(resolve => setTimeout(resolve, 10));

    const values: number[] = [];
    subject.subscribe(v => values.push(v));

    // Wait for subscription to process
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(values).toEqual([456]);
  });

  it('should support unsubscribe and stop receiving further values', async () => {
    const subject = createBehaviorSubject<number>(0);

    const values: number[] = [];
    const sub = subject.subscribe(v => values.push(v));

    subject.next(1);

    // Wait for value to be processed
    await new Promise(resolve => setTimeout(resolve, 10));

    sub.unsubscribe();
    subject.next(2); // should not be received

    // Wait a bit more to ensure no further values
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(values).toEqual([0, 1]);
  });

  it('should emit error and stop further emissions when errored', async () => {
    const subject = createBehaviorSubject<number>(0);

    const values: number[] = [];
    let caughtError: any = null;

    subject.subscribe({
      next: v => values.push(v),
      error: e => caughtError = e
    });

    subject.next(1);
    subject.error(new Error('boom!'));
    subject.next(2); // ignored

    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(values).toEqual([0, 1]);
    expect(caughtError).toEqual(jasmine.any(Error));
    expect((caughtError as Error).message).toBe('boom!');
  });

  it('should support query() to get the latest value without subscribing', async () => {
    const subject = createBehaviorSubject<number>(10);
    expect(await subject.query()).toBe(10);

    subject.next(20);
    expect(await subject.query()).toBe(20);

    subject.next(30);
    expect(await subject.query()).toBe(30);
    subject.complete();
  });
});

describe('createBehaviorSubjectBuffer', () => {
  it('should deliver the initial value immediately on first read after attachReader', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(123);

    const readerId = await buffer.attachReader();
    const result = await buffer.read(readerId);

    expect(result).toEqual({ value: 123, done: false });
  });

  it('should deliver subsequent values in order to readers', async () => {
    const buffer = createBehaviorSubjectBuffer<string>('first');
    const r = await buffer.attachReader();

    // Initial
    let res = await buffer.read(r);
    expect(res.value).toBe('first');

    // Write new values
    await buffer.write('second');
    res = await buffer.read(r);
    expect(res.value).toBe('second');

    await buffer.write('third');
    res = await buffer.read(r);
    expect(res.value).toBe('third');
  });

  it('should let late subscribers see the latest value immediately', async () => {
    const buffer = createBehaviorSubjectBuffer<string>('init');
    const r1 = await buffer.attachReader();
    await buffer.read(r1); // consume "init"

    await buffer.write('latest');

    // Attach new reader after new value
    const r2 = await buffer.attachReader();
    const res2 = await buffer.read(r2);
    expect(res2.value).toBe('latest');
  });

  it('should support peek without consuming the value', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(10);
    const r = await buffer.attachReader();

    const peek1 = await buffer.peek(r);
    expect(peek1.value).toBe(10);

    // After peek, read should still return the same
    const res = await buffer.read(r);
    expect(res.value).toBe(10);
  });

  it('should mark reader as completed after complete()', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(1);
    const r = await buffer.attachReader();

    await buffer.read(r); // consume initial
    await buffer.complete();

    const doneRes = await buffer.read(r);
    expect(doneRes.done).toBe(true);
    expect(buffer.completed(r)).toBe(true);
  });

  it('should propagate errors to readers', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(0);
    const r = await buffer.attachReader();

    await buffer.read(r); // consume initial

    const err = new Error('fail');
    await buffer.error(err);

    await expectAsync(buffer.read(r)).toBeRejectedWith(err);
  });

  it('should allow multiple readers independently', async () => {
    const buffer = createBehaviorSubjectBuffer<string>('init');

    const r1 = await buffer.attachReader();
    const r2 = await buffer.attachReader();

    const v1 = await buffer.read(r1);
    const v2 = await buffer.read(r2);

    expect(v1.value).toBe('init');
    expect(v2.value).toBe('init');

    await buffer.write('next');

    const n1 = await buffer.read(r1);
    const n2 = await buffer.read(r2);

    expect(n1.value).toBe('next');
    expect(n2.value).toBe('next');
  });

  it('should keep latest value for new readers even after many writes', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(0);

    await buffer.write(1);
    await buffer.write(2);
    await buffer.write(3);

    const r = await buffer.attachReader();
    const res = await buffer.read(r);

    expect(res.value).toBe(3); // only latest survives
  });

  it('should allow peek multiple times without consuming', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(5);
    const r = await buffer.attachReader();

    const peek1 = await buffer.peek(r);
    const peek2 = await buffer.peek(r);

    expect(peek1.value).toBe(5);
    expect(peek2.value).toBe(5);

    // Still consumable
    const res = await buffer.read(r);
    expect(res.value).toBe(5);
  });

  it('should complete new readers immediately if buffer is already completed', async () => {
    const buffer = createBehaviorSubjectBuffer<string>('init');
    await buffer.complete();

    const r = await buffer.attachReader();
    const res = await buffer.read(r);

    expect(res.done).toBeTrue();
  });

  it('should reject new readers immediately if buffer is already errored', async () => {
    const buffer = createBehaviorSubjectBuffer<string>('init');
    const err = new Error('already failed');
    await buffer.error(err);
    
    // attachReader should succeed
    const readerId = await buffer.attachReader();
    
    // But reading should throw the error
    await expectAsync(buffer.read(readerId)).toBeRejectedWith(err);
  });

  it('should isolate completion per reader', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(10);

    const r1 = await buffer.attachReader();
    const r2 = await buffer.attachReader();

    await buffer.read(r1); // consume init
    await buffer.read(r2); // consume init
    await buffer.complete();

    const done1 = await buffer.read(r1);
    const done2 = await buffer.read(r2);

    expect(done1.done).toBeTrue();
    expect(done2.done).toBeTrue();
  });

  it('should isolate error per reader', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(99);
    const r1 = await buffer.attachReader();
    const r2 = await buffer.attachReader();

    await buffer.read(r1);
    await buffer.read(r2);

    const err = new Error('boom');
    await buffer.error(err);

    await expectAsync(buffer.read(r1)).toBeRejectedWith(err);
    await expectAsync(buffer.read(r2)).toBeRejectedWith(err);
  });

  it('should handle rapid writes before a read', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(1);
    const r = await buffer.attachReader();

    await buffer.write(2);
    await buffer.write(3);
    await buffer.write(4);

    const res = await buffer.read(r);
    expect(res.value).toBe(4); // only the latest survives
  });

  it('peek should throw if current value is error', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(42);
    const r = await buffer.attachReader();

    await buffer.read(r); // consume initial
    const err = new Error('peek-fail');
    await buffer.error(err);

    await expectAsync(buffer.peek(r)).toBeRejectedWith(err);
  });

  it('value should return undefined if last value is error', async () => {
    const buffer = createBehaviorSubjectBuffer<number>(5);
    const err = new Error('bad');
    await buffer.error(err);

    expect(buffer.value).toBeUndefined();
  });
});
