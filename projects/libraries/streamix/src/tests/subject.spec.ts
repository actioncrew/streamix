import { createSubject, createSubjectBuffer, Subscription } from '@actioncrew/streamix';

describe('createSubject', () => {
  it('should not emit values after unsubscribed', (done) => {
    const subject = createSubject<any>();

    const emittedValues: any[] = [];
    const subscription = subject.subscribe({
      next: value => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(['value1']);
        done();
      }
    });

    subject.next('value1');
    subscription.unsubscribe();
    subject.next('value2');
  });

  it('should allow independent subscriptions with different lifetimes', (done) => {
    const subject = createSubject<any>();

    let emitted1: any[] = [];
    let emitted2: any[] = [];

    const subscription1 = subject.subscribe({
      next: value => emitted1.push(value),
    });

    subject.next('value1');

    const subscription2 = subject.subscribe({
      next: value => emitted2.push(value),
      complete: () => {
        expect(emitted1).toEqual(['value1', 'value2', 'value3', 'value4']);
        expect(emitted2).toEqual(['value2', 'value3', 'value4']); // Late subscriber misses 'value1'
        subscription1.unsubscribe();
        subscription2.unsubscribe();
        done();
      }
    });

    subject.next('value2');
    subject.next('value3');
    subject.next('value4');
    subscription1.unsubscribe(); // Unsubscribing should not affect subscription2
    subject.complete();
  });

  it('should not send past values to late subscribers', (done) => {
    const subject = createSubject<any>();

    const emittedValues1: any[] = [];
    const emittedValues2: any[] = [];

    const subscription1 = subject.subscribe({
      next: value => emittedValues1.push(value),
    });

    subject.next('value1');

    const subscription2 = subject.subscribe({
      next: value => emittedValues2.push(value),
      complete: () => {
        expect(emittedValues1).toEqual(['value1', 'value2']);
        expect(emittedValues2).toEqual(['value2']); // Only gets value2
        subscription1.unsubscribe();
        subscription2.unsubscribe();
        done();
      }
    });

    subject.next('value2');
    subject.complete();
  });

  it('should emit values to subscribers', (done) => {
    const subject = createSubject<any>();

    const emittedValues: any[] = [];
    const subscription: Subscription = subject.subscribe({
      next: value => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(['value1', 'value2']);
        subscription.unsubscribe();
        done();
      }
    });

    subject.next('value1');
    subject.next('value2');
    subject.complete();
  });

  it('should clear emission queue on cancel', (done) => {
    const subject = createSubject<any>();

    const emittedValues: any[] = [];
    const subscription = subject.subscribe({
      next: value => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(['value1']);
        subscription.unsubscribe();
        done();
      }
    });

    subject.next('value1');
    subject.complete();
    subject.next('value2');
  });

  it('stress test, synchronous case', (done) => {
    const subject = createSubject<any>();

    let counter = 0;
    const subscription = subject.subscribe({
      next: value => expect(value === counter++).toBeTruthy(),
      complete: () => {
        subscription.unsubscribe();
        done();
      }
    });

    for (let i = 0; i < 1000; i++) {
      subject.next(i);
    }

    subject.complete();
  });

  it('stress test, asynchronous case', async () => {
    const subject = createSubject<number>();
    let counter = 0;
    let completed = false;

    const subscription = subject.subscribe({
      next: value => {
        expect(value).toBe(counter++);
      },
      complete: () => {
        completed = true;
        subscription.unsubscribe();
      }
    });

    // Send 1000 values
    for (let i = 0; i < 1000; i++) {
      subject.next(i);
    }

    subject.complete();

    // Wait for completion to be processed
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(completed).toBe(true);
    expect(counter).toBe(1000);
  });

  it('should emit values to multiple subscribers', (done) => {
    const subject = createSubject<any>();

    const emittedValues1: any[] = [];
    const emittedValues2: any[] = [];

    const subscription1 = subject.subscribe({
      next: value => emittedValues1.push(value),
    });

    const subscription2 = subject.subscribe({
      next: value => emittedValues2.push(value),
      complete: () => {
        expect(emittedValues1).toEqual(['value1', 'value2']);
        expect(emittedValues2).toEqual(['value1', 'value2']);
        subscription1.unsubscribe();
        subscription2.unsubscribe();
        done();
      }
    });

    subject.next('value1');
    subject.next('value2');

    subject.complete();
  });

  it('should allow one subscription to unsubscribe without affecting others', (done) => {
    const subject = createSubject<any>();

    const emittedValues1: any[] = [];
    const emittedValues2: any[] = [];

    const subscription1 = subject.subscribe({
      next: value => emittedValues1.push(value),
    });

    const subscription2 = subject.subscribe({
      next: value => emittedValues2.push(value),
      complete: () => {
        expect(emittedValues1).toEqual(['value1']);
        expect(emittedValues2).toEqual(['value1', 'value2']);
        subscription2.unsubscribe();
        done();
      }
    });

    subject.next('value1');
    subscription1.unsubscribe();
    subject.next('value2');
    subject.complete();
  });

  it('should handle multiple subscribers in a stress test', (done) => {
    const subject = createSubject<any>();

    let counter1 = 0, counter2 = 0;
    const subscription1 = subject.subscribe({
      next: value => expect(value === counter1++).toBeTruthy(),
    });

    const subscription2 = subject.subscribe({
      next: value => expect(value === counter2++).toBeTruthy(),
      complete: () => {
        subscription1.unsubscribe();
        subscription2.unsubscribe();
        done();
      }
    });

    for (let i = 0; i < 1000; i++) {
      subject.next(i);
    }

    subject.complete();
  });

  it('should handle void subjects (signals without data)', (done) => {
    const subject = createSubject<void>();

    let nextCallCount = 0;
    let completedCallCount = 0;

    const subscription = subject.subscribe({
      next: (value) => {
        expect(value).toBeUndefined();
        nextCallCount++;
      },
      complete: () => {
        completedCallCount++;
        expect(nextCallCount).toBe(3);
        expect(completedCallCount).toBe(1);
        subscription.unsubscribe();
        done();
      }
    });

    // For void subjects, we call next() without arguments or with undefined
    subject.next();
    subject.next(undefined);
    subject.next();

    subject.complete();
  });

  it('should handle void subjects with multiple subscribers', (done) => {
    const subject = createSubject<void>();

    let subscriber1Calls = 0;
    let subscriber2Calls = 0;
    let completionCount = 0;

    const subscription1 = subject.subscribe({
      next: () => subscriber1Calls++,
      complete: () => {
        completionCount++;
        if (completionCount === 2) {
          expect(subscriber1Calls).toBe(2);
          expect(subscriber2Calls).toBe(2);
          subscription1.unsubscribe();
          subscription2.unsubscribe();
          done();
        }
      }
    });

    const subscription2 = subject.subscribe({
      next: () => subscriber2Calls++,
      complete: () => {
        completionCount++;
        if (completionCount === 2) {
          expect(subscriber1Calls).toBe(2);
          expect(subscriber2Calls).toBe(2);
          subscription1.unsubscribe();
          subscription2.unsubscribe();
          done();
        }
      }
    });

    // Signal twice
    subject.next();
    subject.next();
    subject.complete();
  });

  it('should handle void subject unsubscription correctly', (done) => {
    const subject = createSubject<void>();

    let subscriber1Calls = 0;
    let subscriber2Calls = 0;

    const subscription1 = subject.subscribe({
      next: () => subscriber1Calls++
    });

    const subscription2 = subject.subscribe({
      next: () => subscriber2Calls++,
      complete: () => {
        expect(subscriber1Calls).toBe(1); // Only received first signal
        expect(subscriber2Calls).toBe(2); // Received both signals
        subscription2.unsubscribe();
        done();
      }
    });

    subject.next(); // Both subscribers get this
    subscription1.unsubscribe(); // Unsubscribe first subscriber
    subject.next(); // Only subscriber2 gets this
    subject.complete();
  });
});

describe('createSubjectBuffer', () => {
  it('should not deliver any initial value to new readers', async () => {
    const buffer = createSubjectBuffer<number>();
    const readerId = await buffer.attachReader();
    const res = await buffer.peek(readerId);
    expect(res.value).toBeUndefined();
    expect(res.done).toBe(false);
  });

  it('should deliver written values to all readers', async () => {
    const buffer = createSubjectBuffer<string>();
    const r1 = await buffer.attachReader();
    const r2 = await buffer.attachReader();

    await buffer.write('a');

    const v1 = await buffer.read(r1);
    const v2 = await buffer.read(r2);

    expect(v1.value).toBe('a');
    expect(v2.value).toBe('a');
  });

  it('should deliver multiple writes in order', async () => {
    const buffer = createSubjectBuffer<number>();
    const r = await buffer.attachReader();

    await buffer.write(1);
    await buffer.write(2);
    await buffer.write(3);

    expect((await buffer.read(r)).value).toBe(1);
    expect((await buffer.read(r)).value).toBe(2);
    expect((await buffer.read(r)).value).toBe(3);
  });

  it('should support peek without consuming', async () => {
    const buffer = createSubjectBuffer<number>();
    const r = await buffer.attachReader();

    await buffer.write(10);
    const peek1 = await buffer.peek(r);
    const peek2 = await buffer.peek(r);

    expect(peek1.value).toBe(10);
    expect(peek2.value).toBe(10);

    const res = await buffer.read(r);
    expect(res.value).toBe(10);
  });

  it('should complete readers after complete()', async () => {
    const buffer = createSubjectBuffer<number>();
    const r = await buffer.attachReader();

    await buffer.write(1);
    await buffer.complete();

    expect((await buffer.read(r)).value).toBe(1);
    const doneRes = await buffer.read(r);
    expect(doneRes.done).toBeTrue();
    expect(buffer.completed(r)).toBeTrue();
  });

  it('should propagate errors to readers', async () => {
    const buffer = createSubjectBuffer<number>();
    const r = await buffer.attachReader();

    await buffer.write(42);
    const err = new Error('fail');
    await buffer.error(err);

    await expectAsync(buffer.read(r)).toBeResolved(); // 42
    await expectAsync(buffer.read(r)).toBeRejectedWith(err);
  });

  it('should allow multiple readers independently', async () => {
    const buffer = createSubjectBuffer<string>();
    const r1 = await buffer.attachReader();
    const r2 = await buffer.attachReader();

    await buffer.write('x');

    const v1 = await buffer.read(r1);
    const v2 = await buffer.read(r2);

    expect(v1.value).toBe('x');
    expect(v2.value).toBe('x');

    await buffer.write('y');

    const n1 = await buffer.read(r1);
    const n2 = await buffer.read(r2);

    expect(n1.value).toBe('y');
    expect(n2.value).toBe('y');
  });

  it('should isolate completion per reader', async () => {
    const buffer = createSubjectBuffer<number>();
    const r1 = await buffer.attachReader();
    const r2 = await buffer.attachReader();

    await buffer.write(1);
    await buffer.complete();

    expect((await buffer.read(r1)).value).toBe(1);
    expect((await buffer.read(r2)).value).toBe(1);

    expect((await buffer.read(r1)).done).toBeTrue();
    expect((await buffer.read(r2)).done).toBeTrue();
  });

  it('should isolate errors per reader', async () => {
    const buffer = createSubjectBuffer<number>();
    const r1 = await buffer.attachReader();
    const r2 = await buffer.attachReader();

    await buffer.write(7);
    const err = new Error('boom');
    await buffer.error(err);

    expect((await buffer.read(r1)).value).toBe(7);
    expect((await buffer.read(r2)).value).toBe(7);

    await expectAsync(buffer.read(r1)).toBeRejectedWith(err);
    await expectAsync(buffer.read(r2)).toBeRejectedWith(err);
  });

  it('should handle rapid writes before a read', async () => {
    const buffer = createSubjectBuffer<number>();
    const r = await buffer.attachReader();

    await buffer.write(1);
    await buffer.write(2);
    await buffer.write(3);

    expect((await buffer.read(r)).value).toBe(1);
    expect((await buffer.read(r)).value).toBe(2);
    expect((await buffer.read(r)).value).toBe(3);
  });
});
