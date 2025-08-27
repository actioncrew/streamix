import { range } from "@actioncrew/streamix";

describe("range", () => {
  it("should emit the correct range of values", async () => {
    const start = 1;
    const count = 5;
    const expectedValues = [1, 2, 3, 4, 5];
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    rangeStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(expectedValues);
      },
      error: (err) => fail(err),
    });
  });

  it("should stop emitting after the specified count", async () => {
    const start = 0;
    const count = 3;
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    rangeStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues.length).toBe(count); // Should emit exactly `count` values
      },
      error: (err) => fail(err),
    });
  });

  it("should handle a zero count by completing without emitting values", async () => {
    const start = 10;
    const count = 0;
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    rangeStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues.length).toBe(0); // Should not emit any values
      },
      error: (err) => fail(err),
    });
  });

  it("should emit values in order starting from the start value", async () => {
    const start = 10;
    const count = 4;
    const expectedValues = [10, 11, 12, 13];
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    rangeStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(expectedValues);
      },
      error: (err) => fail(err),
    });
  });

  it("should complete immediately if count is 0", async () => {
    const start = 5;
    const count = 0;
    const emittedValues: number[] = [];

    const rangeStream = range(start, count);

    rangeStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues.length).toBe(0); // No values should be emitted
      },
      error: (err) => fail(err),
    });
  });
});
