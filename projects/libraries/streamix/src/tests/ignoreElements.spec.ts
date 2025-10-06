import { createSubject, ignoreElements } from "@actioncrew/streamix";

describe("ignoreElements", () => {
  it("should ignore all emitted values and only emit complete", (done) => {
    const sourceStream = createSubject<number>();
    const emittedValues: number[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([]);
        done();
      },
      error: (err) => done.fail(err.message),
    });

    sourceStream.next(1);
    sourceStream.next(2);
    sourceStream.next(3);
    sourceStream.complete();
  });

  it("should pass error notifications through", (done) => {
    const sourceStream = createSubject<number>();
    const emittedValues: number[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {},
      error: (err) => {
        expect(err.message).toBe("Test error");
        expect(emittedValues).toEqual([]);
        done();
      },
    });

    sourceStream.next(1);
    sourceStream.next(2);
    sourceStream.error(new Error("Test error"));
  });

  it("should complete after source stream completes", (done) => {
    const sourceStream = createSubject<number>();
    const emittedValues: number[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([]);
        done();
      },
      error: (err) => done.fail(err.message),
    });

    sourceStream.next(10);
    sourceStream.next(20);
    sourceStream.complete();
  });

  it("should not emit any value but should handle complete", (done) => {
    const sourceStream = createSubject<string>();
    const emittedValues: string[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([]);
        done();
      },
      error: (err) => done.fail(err.message),
    });

    sourceStream.next("value1");
    sourceStream.next("value2");
    sourceStream.complete();
  });

  it("should handle error in source stream", (done) => {
    const sourceStream = createSubject<string>();
    const emittedValues: string[] = [];
    const ignoredStream = sourceStream.pipe(ignoreElements());

    ignoredStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {},
      error: (err) => {
        expect(err.message).toBe("Some error");
        expect(emittedValues).toEqual([]);
        done();
      },
    });

    sourceStream.next("value1");
    sourceStream.next("value2");
    sourceStream.error(new Error("Some error"));
  });
});