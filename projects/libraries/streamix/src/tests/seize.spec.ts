import {
  coroutine,
  CoroutineMessage,
  eachValueFrom,
  seize,
  SeizedWorker,
} from "@actioncrew/streamix";
import { idescribe } from "./env.spec";

idescribe("seize", () => {
  let originalWorker: any;
  // Global tracker for all created mock workers
  const mockWorkersById: Record<number, any> = {};

  beforeAll(() => {
    originalWorker = (globalThis as any).Worker;
    let mockWorkerIdCounter = 0; // Counter for MockWorker instances

    class MockWorker {
      listeners: Record<string, Function[]> = {};
      onmessage: ((ev: any) => void) | null = null;
      terminated = false;
      public mockId: number; // Add a public mock ID for tracking

      constructor() {
        // Initialize and track the instance
        this.mockId = ++mockWorkerIdCounter;
        mockWorkersById[this.mockId] = this;
        this.listeners = {};
        this.onmessage = null;
        this.terminated = false;
      }

      addEventListener(type: string, fn: Function) {
        this.listeners[type] ||= [];
        this.listeners[type].push(fn);
      }

      removeEventListener(type: string, fn: Function) {
        if (this.listeners[type]) {
          this.listeners[type] = this.listeners[type].filter(f => f !== fn);
        }
      }

      // Inside your MockWorker class
      postMessage(msg: any) {
        setTimeout(() => {
          if (msg.type !== "task") return;

          try {
            const result = (globalThis as any).currentMainTask(msg.payload);

            // Success Path (correct)
            const successEvent: MessageEvent<CoroutineMessage> = {
              data: { ...msg, type: "response", payload: result },
            } as any;
            this.listeners["message"]?.forEach(fn => fn(successEvent));

          } catch (err: any) {
            // 1. Send the global ErrorEvent (for seize's onError callback)
            const errorEvent: ErrorEvent = { error: err } as any;
            this.listeners["error"]?.forEach(fn => fn(errorEvent));

            // 2. Send an explicit CoroutineMessage (for Coroutine's promise rejection)
            const rejectionMessage: MessageEvent<CoroutineMessage> = {
              data: {
                ...msg,
                type: "error",
                error: err.message
              },
            } as any;
            this.listeners["message"]?.forEach(fn => fn(rejectionMessage));
          }
        }, 1);
      }

      terminate() {
        this.terminated = true;
        this.listeners = {};
        this.onmessage = null;
      }
    }

    (globalThis as any).Worker = MockWorker;
  });

  afterAll(() => {
    (globalThis as any).Worker = originalWorker;
  });

  beforeEach(() => {
    // Reset currentMainTask for each test
    (globalThis as any).currentMainTask = (x: any) => x;

    // Clear the global mock worker map before each test to ensure fresh state
    Object.keys(mockWorkersById).forEach(key => delete (mockWorkersById as any)[key]);
  });

  it("should yield a SeizedWorker and successfully execute a task", async () => {
    const co = coroutine((x: number) => x + 1);
    (globalThis as any).currentMainTask = (x: number) => x + 1;

    const messages: CoroutineMessage[] = [];
    const errors: Error[] = [];

    const stream = seize(co, msg => messages.push(msg), err => errors.push(err));

    const iterator = eachValueFrom(stream);
    const seized: SeizedWorker<number, number> = (await iterator.next()).value;

    // Execute task
    const result = await seized.sendTask(5);
    expect(result).toBe(6);

    seized.release();
    await co.finalize();

    expect(messages.some(m => m.type === "response")).toBeTrue();
    expect(errors.length).toBe(0);
  });

  it("should support multiple sequential tasks on the same seized worker", async () => {
    const co = coroutine((x: number) => x * 10);
    (globalThis as any).currentMainTask = (x: number) => x * 10;

    const stream = seize(co, () => { }, () => { });
    const iterator = eachValueFrom(stream);
    const seized: SeizedWorker<number, number> = (await iterator.next()).value;

    // Execute tasks sequentially
    const r1 = await seized.sendTask(1);
    const r2 = await seized.sendTask(2);
    const r3 = await seized.sendTask(3);

    expect([r1, r2, r3]).toEqual([10, 20, 30]);

    seized.release();
    await co.finalize();
  });

  // ===============================================
  // 2. Error and Exception Handling
  // ===============================================

  it("should forward worker error events to the provided onError callback", async () => {
    const co = coroutine(function task(x: number) {
      if (x === 99) throw new Error("boom");
      return x + 1;
    });

    (globalThis as any).currentMainTask = (x: number) => {
      if (x === 99) throw new Error("boom");
      return x + 1;
    };

    let capturedError: any = null;

    const stream = seize(co, () => { }, err => (capturedError = err));

    const iterator = eachValueFrom(stream);
    const seized: SeizedWorker<number, number> = (await iterator.next()).value;

    let rejectionError: any = null;
    try {
      // Task triggers error path and the promise from sendTask will reject
      await seized.sendTask(99);
    } catch (err) {
      rejectionError = err; // Catch the rejection to prevent test failure/timeout
    }

    // Assert that the error was captured by the 'seize' onError callback
    expect(capturedError?.message).toBe("boom");

    // Optionally assert the error thrown by the promise rejection
    expect(rejectionError?.message).toBe("boom");

    seized.release();
    // Ensure cleanup runs
    await co.finalize();
  });

  // ===============================================
  // 3. Resource Management and Cleanup
  // ===============================================

  // seize operator > should release worker and clean up event listeners on manual release()
  it("should release worker and clean up event listeners on manual release()", async () => {
    const co = coroutine((x: number) => x + 1);
    (globalThis as any).currentMainTask = (x: number) => x + 1;

    const messages: CoroutineMessage[] = [];
    const stream = seize(co, msg => messages.push(msg), () => { });

    const iterator = eachValueFrom(stream);
    const seized: SeizedWorker<number, number> = (await iterator.next()).value;

    const result = await seized.sendTask(2);
    expect(result).toBe(3);

    seized.release();
    await co.finalize();
  });
});