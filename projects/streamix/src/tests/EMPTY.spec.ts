import { EMPTY, flags } from '../lib';

describe('EmptyStream', () => {
  it('should auto-complete without emitting any values', async () => {
    const emptyStream = EMPTY;

    let emittedValues: any[] = [];
    const subscription = emptyStream({
      next: (value) => emittedValues.push(value),
      complete: () => {
        // Ensure no values were emitted
        expect(emittedValues).toHaveLength(0);

        // Ensure the stream is auto-completed
        expect(emptyStream[flags].isAutoComplete).toBe(true);

        subscription.unsubscribe();
      }
    })
  });
});

describe('EMPTY constant', () => {
  it('should behave the same as an instance of EmptyStream', async () => {
    let emittedValues: any[] = [];
    const subscription = EMPTY({
      next:(value) => emittedValues.push(value),
      complete: () => {
        // Ensure no values were emitted
        expect(emittedValues).toHaveLength(0);

        // Ensure the stream is auto-completed
        expect(EMPTY[flags].isAutoComplete).toBe(true);

        subscription.unsubscribe();
      }
    });
  });
});
