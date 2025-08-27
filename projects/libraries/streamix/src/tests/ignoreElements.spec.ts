import { createSubject, ignoreElements } from "@actioncrew/streamix"; // Import your ignoreElements operator

describe("ignoreElements", () => {
  it("should ignore all emitted values and only emit complete", async () => {
    const sourceStream = createSubject<number>();
    const emittedValues: number[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value), // Should not be called
      complete: () => {
        expect(emittedValues).toEqual([]); // Should be empty since all emissions are ignored
      },
      error: (err) => fail(err),
    });

    sourceStream.next(1); // Ignored
    sourceStream.next(2); // Ignored
    sourceStream.next(3); // Ignored
    sourceStream.complete(); // Should trigger complete
  });

  it("should pass error notifications through", async () => {
    const sourceStream = createSubject<number>();
    const emittedValues: number[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value), // Should not be called
      complete: () => {},
      error: (err) => {
        expect(err.message).toBe("Test error"); // Should propagate error from source stream
      },
    });

    sourceStream.next(1); // Ignored
    sourceStream.next(2); // Ignored
    sourceStream.error(new Error("Test error")); // Should propagate error
  });

  it("should complete after source stream completes", async () => {
    const sourceStream = createSubject<number>();
    const emittedValues: number[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value), // Should not be called
      complete: () => {
        expect(emittedValues).toEqual([]); // Should be empty since all emissions are ignored
      },
      error: (err) => fail(err),
    });

    sourceStream.next(10); // Ignored
    sourceStream.next(20); // Ignored
    sourceStream.complete(); // Should trigger complete
  });

  it("should not emit any value but should handle complete", async () => {
    const sourceStream = createSubject<string>();
    const emittedValues: string[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value), // Should not be called
      complete: () => {
        expect(emittedValues).toEqual([]); // Should be empty since all emissions are ignored
      },
      error: (err) => fail(err),
    });

    sourceStream.next("value1"); // Ignored
    sourceStream.next("value2"); // Ignored
    sourceStream.complete(); // Should trigger complete
  });

  it("should handle error in source stream", async () => {
    const sourceStream = createSubject<string>();
    const emittedValues: string[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value), // Should not be called
      complete: () => {},
      error: (err) => {
        expect(err.message).toBe("Some error"); // Should propagate error from source stream
      },
    });

    sourceStream.next("value1"); // Ignored
    sourceStream.next("value2"); // Ignored
    sourceStream.error(new Error("Some error")); // Should propagate error
  });
});
