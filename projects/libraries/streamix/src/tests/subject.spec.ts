import { createSubject, Subscription } from '../lib';

describe('Subject', () => {
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

  it('should not emit values after unsubscribed', (done) => {
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
    subscription.unsubscribe();
    subject.next('value2');
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
    const subject = createSubject<any>();

    let counter = 0;
    const subscription: Subscription = subject.subscribe({
      next: value => expect(value === counter++).toBeTruthy(),
      complete: () => subscription.unsubscribe()
    })

    for (let i = 0; i < 1000; i++) {
      subject.next(i);
    }

    await subject.complete();
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
        expect(emitted1).toEqual(['value1', 'value2', 'value3']);
        expect(emitted2).toEqual(['value2', 'value3']); // Late subscriber misses 'value1'
        subscription1.unsubscribe();
        subscription2.unsubscribe();
        done();
      }
    });

    subject.next('value2');
    subscription1.unsubscribe(); // Unsubscribing should not affect subscription2
    subject.next('value3');
    subject.complete();
  });

  it('should receive emitted values via async iterator', async () => {
    const subject = createSubject<any>();
    const emittedValues: any[] = [];

    (async () => {
      for await (const value of subject) {
        emittedValues.push(value);
      }
    })();

    subject.next('value1');
    subject.next('value2');
    await subject.complete();

    expect(emittedValues).toEqual(['value1', 'value2']);
  });

  it('should work with multiple async iterators independently', async () => {
    const subject = createSubject<any>();

    const emitted1: any[] = [];
    const emitted2: any[] = [];

    const iterator1 = (async () => {
      for await (const value of subject) {
        emitted1.push(value);
      }
    })();

    subject.next('value1');

    const iterator2 = (async () => {
      for await (const value of subject) {
        emitted2.push(value);
      }
    })();

    subject.next('value2');
    await subject.complete();

    await iterator1;
    await iterator2;

    expect(emitted1).toEqual(['value1', 'value2']);
    expect(emitted2).toEqual(['value2']); // Late iterator only gets `value2`
  });

  it('should allow cancelling an async iterator without affecting others', async () => {
    const subject = createSubject<any>();

    const emitted1: any[] = [];
    const emitted2: any[] = [];

    const iterator1 = (async () => {
      for await (const value of subject) {
        emitted1.push(value);
        if (value === 'value1') break; // Stop after first value
      }
    })();

    const iterator2 = (async () => {
      for await (const value of subject) {
        emitted2.push(value);
      }
    })();

    subject.next('value1');
    subject.next('value2');
    await subject.complete();

    await iterator1;
    await iterator2;

    expect(emitted1).toEqual(['value1']); // Stopped early
    expect(emitted2).toEqual(['value1', 'value2']); // Continued normally
  });

  it('should propagate errors correctly to async iterators', async () => {
    const subject = createSubject<any>();
    const receivedError = new Error('Test Error');

    let caughtError: Error | null = null;

    const iterator = async () => {
      try {
        for await (const value of subject) {
          // Process values (not used here)
        }
      } catch (err) {
        caughtError = err as Error;
      }
    };

    iterator();
    subject.next('value1');
    subject.error(receivedError); // Should be caught by iterator

    expect(caughtError!).toEqual(receivedError);
  });

  it('should allow stress test with async iteration', async () => {
    const subject = createSubject<any>();
    let counter = 0;

    const iterator = (async () => {
      for await (const value of subject) {
        expect(value).toBe(counter++);
      }
    })();

    for (let i = 0; i < 1000; i++) {
      subject.next(i);
    }

    await subject.complete();
    await iterator;
  });
});
