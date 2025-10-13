import { compute, coroutine, eachValueFrom } from "@actioncrew/streamix";
import { idescribe } from "./env.spec";

idescribe("compute", () => {
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeAll(() => {
    // Save originals
    originalLog = console.log;
    originalError = console.error;
    originalWarn = console.warn;
  });

  it("should emit a single computed result", async () => {
    const mainTask = (x: number) => x * 2;
    const co = coroutine(mainTask);

    const stream = compute<number>(co, 5);

    const results: number[] = [];
    for await (const v of eachValueFrom(stream)) {
      results.push(v);
    }

    expect(results).toEqual([10]);
  });

  it("should work with multiple compute calls using the same coroutine", async () => {
    const mainTask = (x: number) => x + 1;
    const co = coroutine(mainTask);

    const stream1 = compute<number>(co, 1);
    const stream2 = compute<number>(co, 5);

    const r1: number[] = [];
    const r2: number[] = [];

    for await (const v of eachValueFrom(stream1)) r1.push(v);
    for await (const v of eachValueFrom(stream2)) r2.push(v);

    expect(r1).toEqual([2]); // 1+1
    expect(r2).toEqual([6]); // 5+1
  });

  it("should propagate errors from the coroutine task", async () => {
    
    // Silence them
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};

    const mainTask = (_x: number) => {
      throw new Error("boom");
    };
    const co = coroutine(mainTask);

    const stream = compute(co, 99);

    try {
      for await (const _ of eachValueFrom(stream)) {
        // should not reach here
      }
      fail("Expected error to be thrown");
    } catch (err: any) {
      expect(err.message).toBe("boom");
    } finally {
      // Restore originals
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  });

  it("should complete after emitting one value", async () => {
    const mainTask = (x: number) => x * x;
    const co = coroutine(mainTask);

    const stream = compute<number>(co, 4);

    const results: number[] = [];
    for await (const v of eachValueFrom(stream)) {
      results.push(v);
    }

    expect(results).toEqual([16]);
    // if it emitted more than one, we'd catch it here
    expect(results.length).toBe(1);
  });
});
