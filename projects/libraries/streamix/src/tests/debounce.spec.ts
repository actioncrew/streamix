import { createStream, debounce, from, interval, take } from "@actioncrew/streamix";

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

  it('should debounce values from an interval stream', (done) => {
    const source$ = interval(50).pipe(take(5)); // Emits 0,1,2,3,4 at intervals of 50ms
    const debouncedStream = source$.pipe(debounce(120)); // Debounces emissions

    const emittedValues: number[] = [];

    debouncedStream.subscribe({
      next: (value: number) => emittedValues.push(value),
      complete: () => {
        // Expecting only the last emission to be debounced and received
        expect(emittedValues.length).toBe(1);
        expect(emittedValues[0]).toBe(4); // Last value after debounce period
        done();
      },
    });
  });

  it('should debounce values with rapid emissions', (done) => {
    const values = [1, 2, 3, 4, 5];
    const intervalStream = createStream<number>("interval", async function* () {
      for (const value of values) {
        yield value;
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
