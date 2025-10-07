import { cascade, coroutine, createStream, eachValueFrom } from "@actioncrew/streamix";
import { idescribe } from "./env.spec";

idescribe("cascade", () => {
  it("should process tasks sequentially via processTask", async () => {
    const c1 = coroutine((x: number) => x + 1);
    const c2 = coroutine((x: number) => x * 2);

    const cascaded = cascade(c1, c2);

    const result = await cascaded.processTask(3); // (3 + 1) * 2
    expect(result).toBe(8);

    await cascaded.finalize();
  });

  it("should process tasks sequentially in a stream", async () => {
    const c1 = coroutine((x: number) => x + 1);
    const c2 = coroutine((x: number) => x * 2);

    const stream = createStream("test", async function* () {
      yield 1;
      yield 2;
      yield 3;
    });

    const cascaded = cascade(c1, c2);

    const results: number[] = [];
    for await (const v of eachValueFrom(stream.pipe(cascaded))) {
      results.push(v);
    }

    // (1+1)*2 = 4, (2+1)*2 = 6, (3+1)*2 = 8
    expect(results).toEqual([4, 6, 8]);

    await cascaded.finalize();
  });

  it("should propagate errors from inner coroutine", async () => {
    const c1 = coroutine((x: number) => x + 1);
    const c2 = coroutine((x: number) => {
      if (x === 2) throw new Error("boom");
      return x * 2;
    });

    const cascaded = cascade(c1, c2);

    try {
      await cascaded.processTask(1); // (1+1) => 2, then boom
      fail("Expected error to be thrown");
    } catch (err: any) {
      expect(err.message).toBe("boom");
    }

    await cascaded.finalize();
  });

  it("should finalize all tasks", async () => {
    const finalized: string[] = [];

    const c1 = {
      processTask: async (x: number) => x + 1,
      finalize: async () => finalized.push("c1"),
    } as any;
    const c2 = {
      processTask: async (x: number) => x * 2,
      finalize: async () => finalized.push("c2"),
    } as any;

    const cascaded = cascade(c1, c2);

    const result = await cascaded.processTask(5);
    expect(result).toBe(12);

    await cascaded.finalize();
    expect(finalized).toEqual(["c1", "c2"]);
  });

  it("should handle empty cascades gracefully", async () => {
    const cascaded = cascade(); // no tasks
    const result = await cascaded.processTask(42);

    expect(result).toBe(42);

    await cascaded.finalize();
  });
});
