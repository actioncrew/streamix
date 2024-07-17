import { fromPromise } from '../lib';

describe('FromPromiseStream', () => {
  it('should emit value from resolved promise', async () => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    stream.subscribe((emission) => {
      emittedValues.push(emission.value);
    });

    stream.isStopped.then(() => {
      expect(emittedValues).toEqual([value]);
    })
  });

  it('should complete after emitting value', async () => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    let completed = false;
    stream.isAutoComplete.then(() => {
      completed = true;
    });

    stream.isStopped.then(() => {
      expect(completed).toBe(true);
    });
  });

  it('should handle promise rejection', async () => {
    const error = new Error('Test error');
    const promise = Promise.reject(error);
    const stream = fromPromise(promise);

    let receivedError: Error | undefined;
    const subscription = stream.subscribe(() => {});

    stream.isFailed.then((err) => {
      receivedError = err;
    });

    stream.isStopped.then(() => {
      expect(receivedError).toBe(error);
      subscription.unsubscribe();
    })
  });

  it('should not emit if unsubscribed before run', async () => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    const subscription = stream.subscribe((emission) => {
      emittedValues.push(emission.value);
    });

    subscription.unsubscribe(); // Unsubscribe before running

    stream.isStopped.then(() => {
      expect(emittedValues).toEqual([]);
    })
  });

  it('should not emit if cancelled before run', async () => {
    const value = 'test_value';
    const promise = Promise.resolve(value);
    const stream = fromPromise(promise);

    const emittedValues: any[] = [];
    stream.subscribe((emission) => {
      emittedValues.push(emission.value);
    });

    stream.cancel(); // Cancel before running

    expect(emittedValues).toEqual([]);
  });
});
