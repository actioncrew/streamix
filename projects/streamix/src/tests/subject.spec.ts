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

  test("should iterate over emitted values and complete", async () => {
    const subject = createSubject<number>();
    const receivedValues: number[] = [];

    // Simulate async emissions
    setTimeout(() => subject.next(1), 10);
    setTimeout(() => subject.next(2), 20);
    setTimeout(() => subject.next(3), 30);
    setTimeout(() => subject.complete(), 40); // Completion after all values are emitted

    // Collect emitted values
    const iterateSubject = async () => {
      for await (const emission of subject) {
        receivedValues.push(emission.value!);
      }
    };

    const iterationPromise = iterateSubject();

    // Advance Jest timers to process all setTimeout calls
    jest.runAllTimers();
    await iterationPromise;

    // Assertions
    expect(receivedValues).toEqual([1, 2, 3]);
  });

  test("should catch errors during iteration", async () => {
    const subject = createSubject<number>();
    const receivedValues: number[] = [];
    let caughtError: any = null;

    // Simulate emissions and an error
    setTimeout(() => subject.next(1), 10);
    setTimeout(() => subject.next(2), 20);
    setTimeout(() => subject.error(new Error("Test Error")), 30);

    // Collect values and handle errors
    const iterateSubject = async () => {
      try {
        for await (const emission of subject) {
          receivedValues.push(emission.value!);
        }
      } catch (error) {
        caughtError = error;
      }
    };

    const iterationPromise = iterateSubject();

    // Advance Jest timers
    jest.runAllTimers();
    await iterationPromise;

    // Assertions
    expect(receivedValues).toEqual([1, 2]);
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError?.message).toBe("Test Error");
  });
});
