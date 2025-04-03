import { audit, createSubject } from '../lib';

describe('audit operator', () => {
  let input: ReturnType<typeof createSubject<number>>;

  beforeEach(() => {
    input = createSubject<number>();
  });

  it('should emit values at the specified audit duration', (done) => {
    const auditedStream = input.pipe(audit(100));
    const receivedValues: number[] = [];

    auditedStream.subscribe({
      next: (value: any) => receivedValues.push(value),
      complete: () => {
        expect(receivedValues).toEqual([2, 4]); // Expected output after audit duration
        done();
      },
    });

    input.next(1);
    setTimeout(() => input.next(2), 50); // Skipped due to audit duration
    setTimeout(() => input.next(3), 150); // Emitted after audit duration
    setTimeout(() => input.next(4), 200); // Skipped due to audit duration
    setTimeout(() => input.next(5), 300); // Emitted after audit duration
    setTimeout(() => input.complete(), 400); // Completes the stream
  });

  it('should complete the stream after input completes', (done) => {
    const auditedStream = input.pipe(audit(100));

    let completed = false;

    auditedStream.subscribe({
      complete: () => {
        completed = true;
        expect(completed).toBeTrue(); // Ensure output stream completes
        done();
      },
    });

    input.complete(); // Trigger stream completion
  });

  it('should emit the last value when input completes during audit duration', (done) => {
    const auditedStream = input.pipe(audit(100));
    const receivedValues: number[] = [];

    auditedStream.subscribe({
      next: (value: any) => receivedValues.push(value),
      complete: () => {
        expect(receivedValues).toEqual([2]); // Emit last value before completion
        done();
      },
    });

    input.next(1);
    setTimeout(() => input.next(2), 50); // Skipped due to audit duration
    setTimeout(() => input.next(3), 150); // Last value before input completes
    setTimeout(() => input.complete(), 175); // Completes the input stream
  });

  it('should not emit values if input completes before audit duration', (done) => {
    const auditedStream = input.pipe(audit(100));
    const receivedValues: number[] = [];

    auditedStream.subscribe({
      next: (value: any) => receivedValues.push(value),
      complete: () => {
        expect(receivedValues).toEqual([]); // No values emitted
        done();
      },
    });

    input.next(1);
    setTimeout(() => input.complete(), 50); // Completes before audit duration
  });

  it('should propagate errors from the input stream', (done) => {
    const auditedStream = input.pipe(audit(100));

    auditedStream.subscribe({
      error: (err: any) => {
        expect(err).toEqual(new Error('Test Error')); // Error should propagate
        done();
      },
    });

    input.error(new Error('Test Error')); // Emit error from input stream
  });
});
