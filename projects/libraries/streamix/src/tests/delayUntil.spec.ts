import { createSubject, delayUntil } from "@actioncrew/streamix"; // Import your delayUntil operator


describe("delayUntil", () => {
  it("should delay emissions until the condition stream emits a value", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    await new Promise<void>((resolve, reject) => {
      delayedStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual([1, 2, 3, 4]); // Expectation is now waited for
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(new Error(`Stream failed: ${err}`)),
      });

      sourceStream.next(1); // Buffered
      conditionStream.next("start"); // Emission starts
      sourceStream.next(2); // Emitted
      sourceStream.next(3); // Emitted
      sourceStream.next(4); // Emitted

      // FIX: Must complete the source stream for the delayed stream to complete
      sourceStream.complete();
      conditionStream.complete();
    });
  });


  it("should not emit any values if condition stream does not emit", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    await new Promise<void>((resolve, reject) => {
      delayedStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual([]); // Expectation is now waited for
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(new Error(`Stream failed: ${err}`)),
      });

      sourceStream.next(1);
      sourceStream.next(2);
      sourceStream.next(3);

      // FIX: Must complete the source stream
      sourceStream.complete();
      conditionStream.complete(); // This completes the delayed stream without emitting
    });
  });

  it("should emit the source stream values after condition stream emits", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    await new Promise<void>((resolve, reject) => {
      delayedStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual([10, 20, 30]); // Expectation is now waited for
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(new Error(`Stream failed: ${err}`)),
      });

      conditionStream.next("start"); // Start the emission
      sourceStream.next(10);
      sourceStream.next(20);
      sourceStream.next(30);

      // FIX: Must complete the source stream
      sourceStream.complete();
      conditionStream.complete();
    });
  });

  it("should handle error in source stream", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    // We expect the promise to be rejected
    await expectAsync(new Promise<void>((resolve, reject) => {
      const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

      delayedStream.subscribe({
        next: () => { },
        complete: () => reject(new Error("Stream completed unexpectedly")), // Should not complete
        error: (err) => {
          // If the error callback fires, the test should succeed and resolve/reject logic should handle it
          expect(err.message).toBe("Something went wrong");
          resolve(); // Resolve the promise if the expected error is caught
        },
      });

      sourceStream.next(1);
      sourceStream.error(new Error("Something went wrong")); // Error in the source stream
      conditionStream.next("start"); // Too late, stream already errored

      // If the error doesn't happen, the promise will hang unless we reject it after a timeout.
      // Since the error is synchronous here, we rely on the error callback resolving the promise.
    })).toBeResolved(); // Expect the promise to resolve (because we resolved it on successful error handling)
  });

  it("should complete the stream after both source and condition streams complete", async () => {
    const sourceStream = createSubject<number>();
    const conditionStream = createSubject<any>();

    const emittedValues: number[] = [];
    const delayedStream = sourceStream.pipe(delayUntil(conditionStream));

    await new Promise<void>((resolve, reject) => {
      delayedStream.subscribe({
        next: (value) => emittedValues.push(value),
        complete: () => {
          try {
            expect(emittedValues).toEqual([5, 6, 7]); // Expectation is now waited for
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (err) => reject(new Error(`Stream failed: ${err}`)),
      });

      conditionStream.next("start"); // Start the emission
      sourceStream.next(5);
      sourceStream.next(6);
      sourceStream.next(7);
      sourceStream.complete(); // Complete the source stream
      conditionStream.complete(); // Complete the condition stream
    });
  });
});