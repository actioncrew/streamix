import { createEmission, createStream, debounce, from, timer } from "../lib";

describe('debounce operator', () => {
  it('should debounce values from an array stream', (done) => {
    const values = [1, 2, 3, 4, 5];
    const debouncedStream = from(values).pipe(debounce(100));
    const emittedValues: number[] = [];

    debouncedStream.subscribe({
      next: (value: number) => emittedValues.push(value),
      complete: () => {
        // Only the last value should be emitted due to debounce
        expect(emittedValues).toEqual([5]);
        done();
      },
    });
  });

  it('should debounce values from a timer stream', (done) => {
    const debouncedStream = timer(100).pipe(debounce(150));
    const emittedValues: number[] = [];

    debouncedStream.subscribe({
      next: (value: number) => emittedValues.push(value),
      complete: () => {
        // Only the last emission should be debounced
        expect(emittedValues.length).toBe(2);
        done();
      },
    });
  });

  it('should debounce values with rapid emissions', (done) => {
    const values = [1, 2, 3, 4, 5];
    const intervalStream = createStream<number>("interval", async function* () {
      for (const value of values) {
        yield createEmission({ value });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    const debouncedStream = intervalStream.pipe(debounce(100));
    const emittedValues: number[] = [];

    debouncedStream.subscribe({
      next: (value: number) => emittedValues.push(value),
      complete: () => {
        // Only the last value should be emitted due to debounce
        expect(emittedValues).toEqual([5]);
        done();
      },
    });
  });
});
