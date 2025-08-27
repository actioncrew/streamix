import { createSubject, eachValueFrom, throttle } from '@actioncrew/streamix';

describe('throttle operator', () => {
  it('should emit first value immediately and throttle subsequent values', async () => {
    const output: number[] = [];
    const subject = createSubject<number>();
    const iter = eachValueFrom(subject.pipe(throttle<number>(50)));

    (async () => {
      for await (const v of iter) {
        output.push(v);
      }
    })();

    subject.next(1);  // t0, should emit immediately
    subject.next(2);  // t0 + 0ms, should be throttled
    await new Promise((r) => setTimeout(r, 30));
    subject.next(3);  // t0 + 30ms, should replace pending
    await new Promise((r) => setTimeout(r, 30));
    subject.next(4);  // t0 + 60ms, after first throttle window
    subject.complete();

    // Wait for trailing emissions
    await new Promise((r) => setTimeout(r, 50));

    // Check results
    expect(output[0]).toBe(1); // first emitted immediately
    expect(output).toContain(3); // trailing value from first window
    expect(output).toContain(4); // value after throttle window
    expect(output.length).toBe(3);
  });

  it('should complete after source completes', async () => {
    const subject = createSubject<number>();
    const iter = eachValueFrom(subject.pipe(throttle<number>(50)));

    let completed = false;
    (async () => {
      for await (const _ of iter) { void _; }
      completed = true;
    })();

    subject.next(1);
    subject.next(2);
    subject.complete();

    await new Promise((r) => setTimeout(r, 100));

    expect(completed).toBe(true);
  });

  it('should forward errors from the source', async () => {
    const subject = createSubject<number>();
    const iter = eachValueFrom(subject.pipe(throttle<number>(50)));

    let caught: any = null;
    (async () => {
      try {
        for await (const _ of iter) { void _; }
      } catch (err) {
        caught = err;
      }
    })();

    const error = new Error('test error');
    subject.error(error);

    await new Promise((r) => setTimeout(r, 50));

    expect(caught).toBe(error);
  });
});
