import { buffer, createSubject, eachValueFrom, Stream } from "@actioncrew/streamix";

describe("buffer operator", () => {
  let source: Stream<number>;
  let subject: ReturnType<typeof createSubject<number>>;

  beforeEach(() => {
    subject = createSubject<number>();
    source = subject;
  });

  it("should emit buffered values at the specified interval", async () => {
    const duration = 100;
    const buffered = source.pipe(buffer(duration));
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(buffered)) {
        results.push(value);
      }
    })();

    subject.next(1);
    await new Promise((resolve) => setTimeout(resolve, 25));
    subject.next(2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    subject.next(3);
    await new Promise((resolve) => setTimeout(resolve, 100));
    subject.next(4);
    await new Promise((resolve) => setTimeout(resolve, 100));
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[1, 2, 3], [4]]);
  });

  it("should complete when the source completes", async () => {
    const duration = 100;
    const buffered = source.pipe(buffer(duration));
    let completed = false;

    (async () => {
      for await (const _ of eachValueFrom(buffered)) {
        void _;
      }
      completed = true;
    })();

    subject.next(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(completed).toBeTrue();
  });

  it("should emit the last buffer when the source completes", async () => {
    const duration = 100;
    const buffered = source.pipe(buffer(duration));
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(buffered)) {
        results.push(value);
      }
    })();

    subject.next(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    subject.next(2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([[1, 2]]);
  });

  it("should propagate errors from the source stream", async () => {
    const duration = 100;
    const buffered = source.pipe(buffer(duration));
    let error: any = null;

    const consumerReady = new Promise<void>((resolve) => {
      (async () => {
        try {
          for await (const _ of eachValueFrom(buffered)) {
            resolve(); // Consumer is active
            void _;
          }
        } catch (err) {
          error = err;
        }
      })();
    });

    // Wait until consumer is actively listening
    queueMicrotask(async () => {
      await consumerReady;

      subject.error(new Error("Test error"));

      // Wait for the error to propagate
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(error?.message).toBe("Test error");
    });
  });

  it("should emit empty arrays if no values are received in the interval", async () => {
    const duration = 100;
    const buffered = source.pipe(buffer(duration));
    const results: number[][] = [];

    (async () => {
      for await (const value of eachValueFrom(buffered)) {
        results.push(value);
      }
    })();

    await new Promise((resolve) => setTimeout(resolve, 100));
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([]);
  });
});
