import { audit, createSubject } from '@actioncrew/streamix';

describe('audit operator', () => {
  let input: ReturnType<typeof createSubject<number>>;

  beforeEach(() => {
    input = createSubject<number>();
  });

  it('should emit the latest value after a period of inactivity and on completion', (done) => {
    const auditedStream = input.pipe(audit(100));
    const receivedValues: number[] = [];

    auditedStream.subscribe({
      next: (value: any) => receivedValues.push(value),
      complete: () => {
        // The last buffered value is always emitted on completion.
        expect(receivedValues).toEqual([2, 4, 5]);
        done();
      },
    });

    // 1. New value arrives at 0ms. Timer starts. lastValue = 1.
    input.next(1);
    // 2. New value arrives at 50ms. Timer is active. lastValue = 2.
    setTimeout(() => input.next(2), 50);
    // 3. At 100ms, the timer from value 1 expires. Emits 2.
    // 4. New value arrives at 150ms. Timer starts. lastValue = 3.
    setTimeout(() => input.next(3), 150);
    // 5. New value arrives at 200ms. Timer is active. lastValue = 4.
    setTimeout(() => input.next(4), 200);
    // 6. At 250ms, the timer from value 3 expires. Emits 4.
    // 7. New value arrives at 300ms. Timer starts. lastValue = 5.
    setTimeout(() => input.next(5), 300);
    // 8. Stream completes at 400ms. The pending value 5 is emitted.
    setTimeout(() => input.complete(), 400);
  });

  it('should complete the stream immediately after input completes with no buffered value', (done) => {
    const auditedStream = input.pipe(audit(100));
    const receivedValues: number[] = [];
    let completed = false;

    auditedStream.subscribe({
      next: (value: any) => receivedValues.push(value),
      complete: () => {
        completed = true;
        expect(completed).toBeTrue();
        expect(receivedValues).toEqual([]);
        done();
      },
    });

    input.complete();
  });

  it('should emit the last value when input completes during the audit duration', (done) => {
    const auditedStream = input.pipe(audit(100));
    const receivedValues: number[] = [];

    auditedStream.subscribe({
      next: (value: any) => receivedValues.push(value),
      complete: () => {
        // The last value (3) is buffered when the stream completes and should be emitted.
        expect(receivedValues).toEqual([2, 3]);
        done();
      },
    });

    // 1. New value at 0ms. Timer starts. lastValue = 1.
    input.next(1);
    // 2. New value at 50ms. Timer is active. lastValue = 2.
    setTimeout(() => input.next(2), 50);
    // 3. At 100ms, the timer expires. Emits 2.
    // 4. New value at 150ms. Timer starts. lastValue = 3.
    setTimeout(() => input.next(3), 150);
    // 5. Stream completes at 175ms, before the timer for 3 expires. The pending value 3 is emitted.
    setTimeout(() => input.complete(), 175);
  });

  it('should emit the single value when input completes before audit duration', (done) => {
    const auditedStream = input.pipe(audit(100));
    const receivedValues: number[] = [];

    auditedStream.subscribe({
      next: (value: any) => receivedValues.push(value),
      complete: () => {
        // The value 1 is buffered and emitted on completion.
        expect(receivedValues).toEqual([1]);
        done();
      },
    });

    // 1. New value at 0ms. Timer starts. lastValue = 1.
    input.next(1);
    // 2. Stream completes at 50ms. The pending value 1 is emitted.
    setTimeout(() => input.complete(), 50);
  });

  it('should propagate errors from the input stream', (done) => {
    const auditedStream = input.pipe(audit(100));

    auditedStream.subscribe({
      error: (err: any) => {
        expect(err).toEqual(new Error('Test Error'));
        done();
      },
    });

    input.error(new Error('Test Error'));
  });
});
