import { createStream, createSubject, race } from "@actioncrew/streamix";

describe('race', () => {
  it('should only emit values from the winning stream', (done) => {
    const stream1 = createSubject<number>();
    const stream2 = createSubject<number>();
    const results: number[] = [];

    const racedStream = race([stream1, stream2]);

    racedStream.subscribe({
      next: (value) => {
        results.push(value);
        if (results.length === 2){
          expect(results).toEqual([1,2]);
          done();
        }
      },
      error: done.fail,
      complete: done.fail,
    });

    stream1.next(1);
    stream1.next(2);
    stream2.next(3);
  });

  it('should emit the first value from the winning stream', (done) => {
    const stream1 = createSubject<number>();
    const stream2 = createSubject<number>();

    const racedStream = race([stream1, stream2]);

    racedStream.subscribe({
      next: (value) => {
        expect(value).toBe(1);
        done();
      },
      error: done.fail,
      complete: done.fail,
    });

    stream1.next(1);
    stream2.next(2);
  });

  it('should complete when the winning stream completes', (done) => {
    const stream1 = createSubject<number>();
    const stream2 = createSubject<number>();

    const racedStream = race([stream1, stream2]);

    racedStream.subscribe({
      next: (value) => {
        expect(value).toBe(1);
      },
      error: done.fail,
      complete: () => {
        done();
      },
    });

    stream1.next(1);
    stream1.complete();
    stream2.next(2);
  });

  it('should propagate errors from the winning stream', (done) => {
    const stream1 = createSubject<number>();
    const stream2 = createSubject<number>();
    const errorMsg = 'test error';

    const racedStream = race([stream1, stream2]);

    racedStream.subscribe({
      next: (value) => {
        expect(value).toBe(1);
      },
      error: (err) => {
        expect(err.message).toBe(errorMsg);
      },
      complete: () => done(),
    });

    stream1.next(1);
    stream1.error(new Error(errorMsg));
    stream2.next(2);
  });

  it('should handle multiple streams correctly', (done) => {
    const stream1 = createSubject<number>();
    const stream2 = createSubject<number>();
    const stream3 = createSubject<number>();
    const results: number[] = [];

    const racedStream = race([stream1, stream2, stream3]);

    racedStream.subscribe({
      next: (value) => {
        results.push(value);
      },
      error: done.fail,
      complete: () => {
        expect(results).toEqual([1]);
        done();
      }
    });

    stream1.next(1);
    stream2.next(2);
    stream3.next(4);
    stream1.complete();
    stream2.complete();
    stream3.complete();
  });

  it('should work with streams that emit after a delay', (done) => {
    const stream1 = createStream<number>('delayed1', async function* () {
      await new Promise(resolve => setTimeout(resolve, 10));
      yield 1;
      yield 2;
    });

    const stream2 = createStream<number>('delayed2', async function* () {
      await new Promise(resolve => setTimeout(resolve, 5));
      yield 3;
      yield 4;
    });

    const results: number[] = [];
    const racedStream = race([stream1, stream2]);

    racedStream.subscribe({
      next: (value) => {
        results.push(value);
      },
      error: done.fail,
      complete: () => {
        if(results.length === 2){
          expect(results).toEqual([3,4]);
          done();
        } else {
          done.fail();
        }
      }
    });
  });

  it('should complete when the winning stream completes after a delay', (done) => {
    const stream1 = createStream<number>('delayed1', async function* () {
      await new Promise(resolve => setTimeout(resolve, 100));
      yield 1;
    });

    const stream2 = createStream<number>('delayed2', async function* () {
      await new Promise(resolve => setTimeout(resolve, 50));
      yield 3;
    });

    const racedStream = race([stream1, stream2]);

    racedStream.subscribe({
      next: (value) => {
        expect(value).toBe(3);
      },
      error: done.fail,
      complete: () => {
        done();
      },
    });
  });
});
