import { coroutine, CoroutineMessage, createStream, eachValueFrom } from "@actioncrew/streamix";
import { idescribe } from "./env.spec";

idescribe('coroutine', () => {
  let originalWorker: any;
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeAll(() => {
    // Store the original Worker
    originalWorker = (globalThis as any).Worker;

    // Save originals
    originalLog = console.log;
    originalError = console.error;
    originalWarn = console.warn;

    // Set up globalThis variable for main task
    (globalThis as any).currentMainTask = undefined;

    class MockWorker {
      onmessage: ((ev: any) => void) | null = null;
      listeners: Record<string, ((ev: any) => void)[]> = {};
      terminated = false;
      private workerUtils: any;

      constructor(_url: string, _options?: any) { 
        // Create mock utils for the worker
        this.workerUtils = {
          requestData: (requestPayload: any) => this.handleDataRequest(requestPayload),
          reportProgress: (progressData: any) => this.handleProgressReport(progressData)
        };
      }

      private handleDataRequest(_requestPayload: any): Promise<any> {
        return new Promise((resolve) => {
          // Simulate async data request by resolving with dummy data
          setTimeout(() => {
            resolve({ value: 10, message: "Dummy data from mock worker" });
          }, 1);
        });
      }

      private handleProgressReport(progressData: any) {
        // Progress reports are just logged in tests
        console.log('Progress report:', progressData);
      }

      postMessage(msg: any) {
        setTimeout(() => {
          if (this.terminated) return;
          
          if (msg.type === 'task') {
            try {
              const mainTask = (globalThis as any).currentMainTask;
              if (!mainTask) {
                throw new Error('No main task configured');
              }
              
              let result;
              
              // Check if mainTask expects utils parameter
              if (mainTask.length >= 2) {
                // Call with both data and utils
                result = mainTask(msg.payload, this.workerUtils);
              } else {
                // Call with only data
                result = mainTask(msg.payload);
              }
              
              // Handle both sync and async results
              Promise.resolve(result).then(finalResult => {
                const event: MessageEvent<CoroutineMessage> = {
                  data: { ...msg, type: 'response', payload: finalResult }
                } as any;
                this.onmessage?.(event);
                this.listeners['message']?.forEach(fn => fn(event));
              }).catch(err => {
                const event: MessageEvent<CoroutineMessage> = {
                  data: { ...msg, type: 'error', error: err.message }
                } as any;
                this.onmessage?.(event);
                this.listeners['message']?.forEach(fn => fn(event));
              });
              
            } catch (err: any) {
              const event: MessageEvent<CoroutineMessage> = {
                data: { ...msg, type: 'error', error: err.message }
              } as any;
              this.onmessage?.(event);
              this.listeners['message']?.forEach(fn => fn(event));
            }
          } else if (msg.type === 'data') {
            // Handle responses to worker data requests (if needed)
            console.log('MockWorker received data response:', msg);
          }
        }, 1);
      }

      addEventListener(type: string, fn: (ev: any) => void) {
        this.listeners[type] ||= [];
        this.listeners[type].push(fn);
      }

      removeEventListener(type: string, fn: (ev: any) => void) {
        if (this.listeners[type]) {
          this.listeners[type] = this.listeners[type].filter(f => f !== fn);
        }
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
    delete (globalThis as any).currentMainTask;
  });

  beforeEach(() => {
    // Reset before each test
    (globalThis as any).currentMainTask = undefined;
  });

  it('should process tasks and return results', async () => {
    const mainTask = (x: number) => x + 1;
    (globalThis as any).currentMainTask = mainTask;
    
    const co = coroutine(mainTask);

    const stream = createStream('test', async function* () {
      yield 1;
      yield 2;
      yield 3;
    });

    const processed: number[] = [];
    for await (const v of eachValueFrom(stream.pipe(co))) {
      processed.push(v as number);
    }

    expect(processed).toEqual([2, 3, 4]); // Fixed expectation: x + 1
  });

  it('should allow assignTask directly to a worker', async () => {
    const mainTask = (x: number) => x * 2; // Fixed: x * 2, not x * 3
    (globalThis as any).currentMainTask = mainTask;
    
    const co = coroutine(mainTask);

    const { workerId } = await co.getIdleWorker();
    const result = await co.assignTask(workerId, 5);

    expect(result).toBe(10); // 5 * 2 = 10
    co.returnWorker(workerId);
  });

  it('should process multiple tasks in sequence', async () => {
    const mainTask = (x: number) => x * 2; // Fixed: consistent task logic
    (globalThis as any).currentMainTask = mainTask;
    
    const co = coroutine(mainTask);

    const results = await Promise.all([
      co.processTask(1),
      co.processTask(2),
      co.processTask(3),
    ]);

    expect(results).toEqual([2, 4, 6]); // Fixed expectation: x * 2
  });

  it('should finalize and terminate all workers', async () => {
    const mainTask = (x: number) => x * 2;
    (globalThis as any).currentMainTask = mainTask;
    
    const co = coroutine(mainTask);

    // Get a worker to ensure one is created
    const { workerId } = await co.getIdleWorker();
    co.returnWorker(workerId);
    
    await co.finalize();

    // After finalize, getting a new worker should work
    const { workerId: newWorkerId } = await co.getIdleWorker();
    expect(newWorkerId).toBeGreaterThan(0);
    
    // Clean up
    co.returnWorker(newWorkerId);
    await co.finalize();
  });

  it('should throw error from processTask directly', async () => {
    // Silence them
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};

    const mainTask = () => {
      throw new Error('boom');
    };
    (globalThis as any).currentMainTask = mainTask;

    const co = coroutine(mainTask);

    try {
      await co.processTask(1);
      fail('Expected processTask to throw error');
    } catch (err: any) {
      expect(err.message).toBe('boom');
    }

    // Restore originals
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it('should handle worker errors gracefully in stream', async () => {
     // Silence them
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    
    const mainTask = (x: number) => {
      if (x === 2) {
        throw new Error('boom');
      }
      return x * 2;
    };
    (globalThis as any).currentMainTask = mainTask;

    const co = coroutine(mainTask);

    const stream = createStream('test', async function* () {
      yield 1;
      yield 2; // This will cause an error
      yield 3;
    });

    const processed: number[] = [];
    let errorCaught = false;

    try {
      for await (const v of eachValueFrom(stream.pipe(co))) {
        processed.push(v as any);
      }
    } catch (err: any) {
      errorCaught = true;
      expect(err.message).toBe('boom');
    }

    expect(errorCaught).toBe(true);
    expect(processed).toEqual([2]); // Only the first value processed successfully
    
    // Restore originals
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it('should handle data requests from workers', async () => {
    // Define the main task as a proper function (not arrow function if that causes issues)
    function mainTask(x: number, utils: any) {
      // Request additional data from main thread
      return utils.requestData({ request: 'more data' }).then((additionalData: any) => {
        return x + additionalData.value;
      });
    }
    
    (globalThis as any).currentMainTask = mainTask;

    const co = coroutine(mainTask);
    
    // Process a task - the worker will request data and our mock will respond with dummy data
    const result = await co.processTask(5);
    
    // The dummy data response adds {value: 10}, so 5 + 10 = 15
    expect(result).toBe(15);
  });
});