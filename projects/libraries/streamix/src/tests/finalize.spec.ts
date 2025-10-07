import { createStream, finalize } from "@actioncrew/streamix";

describe("finalize", () => {

  it("should call finalizer on normal completion", (done) => {
    const called: string[] = [];
    const stream = createStream("test", async function* () {
      yield 1;
      yield 2;
      yield 3;
    });

    const finalStream = stream.pipe(finalize(() => { called.push("finalized"); }));

    const values: number[] = [];
    finalStream.subscribe({
      next: (v: number) => values.push(v),
      complete: () => {
        expect(values).toEqual([1, 2, 3]);
        expect(called).toEqual(["finalized"]);
        done();
      }
    });
  });

  it("should call finalizer if source throws", (done) => {
    const called: string[] = [];
    const stream = createStream("test", async function* () {
      yield 1;
      throw new Error("source error");
    });

    const finalStream = stream.pipe(finalize(() => { called.push("finalized"); }));

    finalStream.subscribe({
      next: () => {},
      error: (err: any) => {
        expect(err.message).toBe("source error");
        expect(called).toEqual(["finalized"]);
        done();
      }
    });
  });

  it("should only call finalizer once even if multiple subscriptions end", (done) => {
    const called: number[] = [];
    const stream = createStream("test", async function* () {
      yield 1;
    });

    const finalStream = stream.pipe(finalize(() => { called.push(1); }));

    // First subscription
    finalStream.subscribe({
      next: () => {},
      complete: () => {
        // Second subscription
        finalStream.subscribe({
          next: () => {},
          complete: () => {
            expect(called).toEqual([1]);
            done();
          }
        });
      }
    });
  });

  it("should support async finalizer", (done) => {
    let finalized = false;
    const stream = createStream("test", async function* () {
      yield 1;
      yield 2;
    });

    const finalStream = stream.pipe(finalize(async () => {
      await new Promise(r => setTimeout(r, 50));
      finalized = true;
    }));

    const values: number[] = [];
    finalStream.subscribe({
      next: (v: number) => values.push(v),
      complete: () => {
        expect(values).toEqual([1, 2]);
        expect(finalized).toBe(true);
        done();
      }
    });
  });
});
