import { createStream, eachValueFrom, observeOn } from "@actioncrew/streamix";

describe('observeOn', () => {
  let originalRequestIdleCallback: typeof requestIdleCallback;
  let mockRequestIdleCallback: jasmine.Spy;

  beforeEach(() => {
    originalRequestIdleCallback = (globalThis as any).requestIdleCallback;
    mockRequestIdleCallback = jasmine
      .createSpy('requestIdleCallback')
      .and.callFake((callback: IdleRequestCallback) => {
        setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 0);
        return 1;
      });

    (globalThis as any).requestIdleCallback = mockRequestIdleCallback;
  });

  afterEach(() => {
    (globalThis as any).requestIdleCallback = originalRequestIdleCallback;
  });

  it('should emit values using microtask scheduling', async () => {
    const values: number[] = [];
    const emissionOrder: string[] = [];
    
    const stream = createStream('test', async function* () {
      yield 1;
      yield 2;
      yield 3;
    });

    const observeOnStream = stream.pipe(observeOn('microtask'));
    
    const consumePromise = (async () => {
      for await (const value of eachValueFrom(observeOnStream)) {
        emissionOrder.push(`value-${value}`);
        values.push(value);
      }
      emissionOrder.push('complete');
    })();

    emissionOrder.push('sync-after-subscribe');
    await consumePromise;

    expect(values).toEqual([1, 2, 3]);
    expect(emissionOrder[0]).toBe('sync-after-subscribe');
    expect(emissionOrder).toContain('value-1');
    expect(emissionOrder[emissionOrder.length - 1]).toBe('complete');
  });

  it('should emit values using macrotask scheduling', (done) => {
    const values: number[] = [];
    
    const stream = createStream('test', async function* () {
      yield 1;
      yield 2;
    });

    const observeOnStream = stream.pipe(observeOn('macrotask'));
    
    setTimeout(async () => {
      try {
        for await (const value of eachValueFrom(observeOnStream)) {
          values.push(value);
        }
        
        expect(values).toEqual([1, 2]);
        done();
      } catch (error: any) {
        done.fail(error);
      }
    }, 10);
  });

  it('should emit values using idle scheduling', (done) => {
    const values: number[] = [];
    
    const stream = createStream('test', async function* () {
      yield 1;
      yield 2;
    });

    const observeOnStream = stream.pipe(observeOn('idle'));
    
    setTimeout(async () => {
      try {
        for await (const value of eachValueFrom(observeOnStream)) {
          values.push(value);
        }
        
        expect(values).toEqual([1, 2]);
        expect(mockRequestIdleCallback).toHaveBeenCalled();
        done();
      } catch (error: any) {
        done.fail(error);
      }
    }, 10);
  });

  it('should propagate errors asynchronously', async () => {
    const error = new Error('Test error');
    
    const stream = createStream('error', async function* () {
      yield 1;
      throw error;
    });

    const observeOnStream = stream.pipe(observeOn('microtask'));
    const values: number[] = [];
    
    try {
      for await (const value of eachValueFrom(observeOnStream)) {
        values.push(value);
      }
      fail('Should have thrown an error');
    } catch (err) {
      expect(values).toEqual([1]);
      expect(err).toBe(error);
    }
  });

  it('should handle empty streams', async () => {
    const values: number[] = [];
    
    const stream = createStream('empty', async function* () {
      // Empty generator
    });

    const observeOnStream = stream.pipe(observeOn('microtask'));
    
    for await (const value of eachValueFrom(observeOnStream)) {
      values.push(value);
    }

    expect(values).toEqual([]);
  });
});
