import { createSubject, delayUntil } from "@actioncrew/streamix"; // Import your delayUntil operator

describe("delayUntil", () => {
  it("should delay emissions until the condition stream emits a value", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    delayedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([1, 2, 3, 4]); // Should emit values only after conditionStream emits
      },
      error: (err) => fail(err),
    });

    sourceStream.next(1); // Will not be emitted
    conditionStream.next("start"); // This will start the emission of the sourceStream
    sourceStream.next(2); // Will be emitted
    sourceStream.next(3); // Will be emitted
    sourceStream.next(4); // Will be emitted
    conditionStream.complete(); // Complete the condition stream
  });

  it("should not emit any values if condition stream does not emit", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    delayedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([]); // Should not emit any values
      },
      error: (err) => fail(err),
    });

    sourceStream.next(1); // Won't be emitted
    sourceStream.next(2); // Won't be emitted
    sourceStream.next(3); // Won't be emitted
    // Condition stream never emits, so source stream won't emit either
    conditionStream.complete(); // Completing condition stream will complete the delayed stream without emitting values
  });

  it("should emit the source stream values after condition stream emits", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    delayedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([10, 20, 30]); // Should emit after condition stream emits
      },
      error: (err) => fail(err),
    });

    conditionStream.next("start"); // Start the emission
    sourceStream.next(10); // Will be emitted
    sourceStream.next(20); // Will be emitted
    sourceStream.next(30); // Will be emitted
    conditionStream.complete(); // Complete the condition stream
  });

  it("should handle error in source stream", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    delayedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {},
      error: (err) => {
        expect(err.message).toBe("Something went wrong");
      },
    });

    sourceStream.next(1); // Won't be emitted
    sourceStream.error(new Error("Something went wrong")); // Error in the source stream
    conditionStream.next("start"); // This will not emit anything since source stream already errored
  });

  it("should complete the stream after both source and condition streams complete", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    delayedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([5, 6, 7]); // Emission happens after condition stream emits
      },
      error: (err) => fail(err),
    });

    conditionStream.next("start"); // Start the emission
    sourceStream.next(5); // Will be emitted
    sourceStream.next(6); // Will be emitted
    sourceStream.next(7); // Will be emitted
    sourceStream.complete(); // Complete the source stream
    conditionStream.complete(); // Complete the condition stream
  });
});
