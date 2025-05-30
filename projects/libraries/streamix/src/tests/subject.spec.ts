import { createSubject, Subscription } from '../lib';

describe('Subject', () => {
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
});
