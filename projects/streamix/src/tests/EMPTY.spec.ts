import { EMPTY, EmptyStream } from '../lib';

describe('EmptyStream', () => {
  it('should auto-complete without emitting any values', async () => {
    const emptyStream = new EmptyStream();

    let emittedValues: any[] = [];
    const subscription = emptyStream.subscribe((value) => {
      emittedValues.push(value);
    });

    emptyStream.isStopped.promise.then(() => {
      // Ensure no values were emitted
      expect(emittedValues).toHaveLength(0);

      // Ensure the stream is auto-completed
      expect(emptyStream.isAutoComplete.value).toBe(true);

      subscription.unsubscribe();
    })
  });
});

describe('EMPTY constant', () => {
  it('should behave the same as an instance of EmptyStream', async () => {
    let emittedValues: any[] = [];
    const subscription = EMPTY.subscribe((value) => {
      emittedValues.push(value);
    });

    EMPTY.isStopped.promise.then(() => {
      // Ensure no values were emitted
      expect(emittedValues).toHaveLength(0);

      // Ensure the stream is auto-completed
      expect(EMPTY.isAutoComplete.value).toBe(true);

      subscription.unsubscribe();
    })
  });
});
