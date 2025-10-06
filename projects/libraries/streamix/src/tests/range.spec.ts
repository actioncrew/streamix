import { range } from "@actioncrew/streamix";

describe("range", () => {
  it("should emit the correct range of values", async () => {
    const start = 1;
    const count = 5;
    const expectedValues = [1, 2, 3, 4, 5];
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    // FIX: Use await Promise to wait for the complete callback
    await new Promise<void>((resolve, reject) => {
      rangeStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual(expectedValues);
            resolve(); // Resolve the promise on successful completion
          } catch (e) {
            reject(e); // Reject if the expectation fails
          }
        },
        error: (err) => reject(err), // Reject the promise if an error occurs
      });
    });
  });

  it("should stop emitting after the specified count", async () => {
    const start = 0;
    const count = 3;
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    await new Promise<void>((resolve, reject) => {
      rangeStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues.length).toBe(count);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(err),
      });
    });
  });

  it("should handle a zero count by completing without emitting values", async () => {
    const start = 10;
    const count = 0;
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    await new Promise<void>((resolve, reject) => {
      rangeStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues.length).toBe(0);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(err),
      });
    });
  });

  it("should emit values in order starting from the start value", async () => {
    const start = 10;
    const count = 4;
    const expectedValues = [10, 11, 12, 13];
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    await new Promise<void>((resolve, reject) => {
      rangeStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual(expectedValues);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(err),
      });
    });
  });

  it("should complete immediately if count is 0", async () => {
    const start = 5;
    const count = 0;
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    await new Promise<void>((resolve, reject) => {
      rangeStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues.length).toBe(0);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(err),
      });
    });
  });
});