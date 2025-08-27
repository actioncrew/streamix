import { bufferCount, createSubject, eachValueFrom, Stream } from "@actioncrew/streamix";

describe("bufferCount operator", () => {
  let source: Stream<number>;
  let subject: ReturnType<typeof createSubject<number>>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it("should emit buffers of the specified size", async () => {
    const buffered = source.pipe(bufferCount(3));
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(buffered)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3); // Emits [1, 2, 3]
    subject.next(4);
    subject.next(5);
    subject.next(6); // Emits [4, 5, 6]
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[1, 2, 3], [4, 5, 6]]);
  });

  it("should emit the remaining buffer when source completes", async () => {
    const buffered = source.pipe(bufferCount(3));
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(buffered)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.complete(); // Emits [1, 2]
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[1, 2]]);
  });

  it("should propagate errors from the source stream", async () => {
    const buffered = source.pipe(bufferCount(3));
    let error: any = null;

    (async () => {
      try {
        for await (const _ of eachValueFrom(buffered)) {
          void _;
        }
      } catch (err) {
        error = err;
      }
    })();

    subject.error(new Error("Test error"));
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(error.message).toBe("Test error");
  });

  it("should not emit empty buffers", async () => {
    const buffered = source.pipe(bufferCount(3));
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(buffered)) {
        results.push(value);
      }
    })();

    subject.complete(); // Should not emit anything
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([]);
  });
});
