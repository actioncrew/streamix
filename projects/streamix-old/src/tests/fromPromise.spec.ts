import { fromPromise } from '../lib';

describe('FromPromiseStream', () => {
  it('should emit value from resolved promise', (done) => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    stream({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([value]);
        done();
      }
    })
  });

  it('should complete after emitting value', (done) => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    let completed = false;
    stream({
      next: () => completed = true,
      complete: () => {
        expect(completed).toBe(true);
        done();
      }
    });
  });

  it('should handle promise rejection', (done) => {
    const error = new Error('Test error');
    const promise = Promise.reject(error);
    const stream = fromPromise(promise);

    let receivedError: Error | undefined;
    const subscription = stream({
      error: (error: any) => receivedError = error,
      complete: () => {
        expect(receivedError).toBe(error);
        subscription.unsubscribe();
        done();
      }
    });
  });

  it('should not emit if unsubscribed before run', async () => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    const subscription = stream({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([]);
      }
    });

    subscription.unsubscribe(); // Unsubscribe before running
  });

  it('should not emit if cancelled before run', async () => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    stream((value) => {
      emittedValues.push(value);
    });

    stream.complete(); // Cancel before running

    expect(emittedValues).toEqual([]);
  });
});
