import { fromPromise } from '@actioncrew/streamix';

describe('FromPromiseStream', () => {
  it('should emit value from resolved promise', (done) => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    stream.subscribe({
      next: (value: any) => emittedValues.push(value),
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
    stream.subscribe({
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
    const subscription = stream.subscribe({
      error: (error: any) => receivedError = error,
      complete: () => {
        expect(receivedError).toBe(error);
        subscription.unsubscribe();
        done();
      }
    });
  });

  it('should not emit if unsubscribed before run', (done) => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    const subscription = stream.subscribe({
      next: (value: any) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([]);
        done();
      }
    });

    subscription.unsubscribe(); // Unsubscribe before running
  });
});
