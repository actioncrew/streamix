import { EMPTY } from '@actioncrew/streamix';

describe('EmptyStream', () => {
  it('should auto-complete without emitting any values', async () => {
    const emptyStream = EMPTY;

    let emittedValues: any[] = [];
    const subscription = emptyStream.subscribe({
      next: (value: any) => emittedValues.push(value),
      complete: () => {
        // Ensure no values were emitted
        expect(emittedValues.length).toBe(0);

        subscription.unsubscribe();
      }
    })
  });
});

describe('EMPTY constant', () => {
  it('should behave the same as an instance of EmptyStream', async () => {
    let emittedValues: any[] = [];
    const subscription = EMPTY.subscribe({
      next:(value: any) => emittedValues.push(value),
      complete: () => {
        // Ensure no values were emitted
        expect(emittedValues.length).toBe(0);

        subscription.unsubscribe();
      }
    });
  });
});
