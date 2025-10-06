import { fromPromise } from '@actioncrew/streamix';

describe('fromPromise', () => {
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

  it('should emit a single value from a Promise and then complete', async () => {
    const promiseValue = 'Hello';
    const promise = Promise.resolve(promiseValue);
    const stream = fromPromise(promise);
    let emittedValues: any[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual([promiseValue]);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: reject
      });
    });
  });

  it('should propagate an error from a rejected Promise', async () => {
    const expectedError = new Error('Promise rejection');
    const promise = Promise.reject(expectedError);
    const stream = fromPromise(promise);

    // We expect the promise to be rejected, so we use async/await with try/catch
    try {
      await new Promise<void>((resolve, reject) => {
        stream.subscribe({
          next: () => reject(new Error('Value emitted unexpectedly')),
          complete: () => reject(new Error('Stream completed unexpectedly')),
          error: (err) => {
            expect(err).toBe(expectedError);
            resolve(); // Resolve on expected error
          }
        });
      });
    } catch (e) {
      // If the promise rejects for any reason other than the expected error, fail
      fail(`Test failed in unexpected way: ${e}`);
    }
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
