import { from } from '@actioncrew/streamix';

describe('from', () => {

  it('should emit values in sequence and complete (Array)', async () => {
    const values = [1, 2, 3];
    const stream = from(values);
    let emittedValues: any[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual(values);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: reject
      });
    });
  });

  it('should emit values from an iterable (Generator)', async () => {
    function* numberGenerator() {
      yield 10;
      yield 20;
      yield 30;
    }
    const stream = from(numberGenerator());
    let emittedValues: number[] = [];
    const expected = [10, 20, 30];

    await new Promise<void>((resolve, reject) => {
      stream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual(expected);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: reject
      });
    });
  });

  it('should stop emitting values when unsubscribe is called early', async () => {
    // Async generator
    async function* asyncNumberGenerator() {
      yield 1;
      await new Promise(r => setTimeout(r, 10));
      yield 2;
      await new Promise(r => setTimeout(r, 10));
      yield 3;
    }

    const stream = from(asyncNumberGenerator());
    const emittedValues: number[] = [];

    await new Promise<void>((resolve, reject) => {
      const subscription = stream.subscribe({
        next: (value) => {
          emittedValues.push(value);
          if (value === 1) {
            // Unsubscribe immediately after first value
            subscription.unsubscribe();

            // Delay a bit to catch any stray emissions
            setTimeout(() => {
              try {
                expect(emittedValues).toEqual([1]); // only first value
                resolve();
              } catch (e) {
                reject(e);
              }
            }, 50);
          }
        },
        error: reject,
        complete: () => {
          // We allow complete() to fire; do not fail the test
        }
      });
    });
  });
});