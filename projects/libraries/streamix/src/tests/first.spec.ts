import { first, from } from "@actioncrew/streamix";

describe('first Operator', () => {
  it('should emit the first value even when there is a delay', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const firstStream = testStream.pipe(first());

    setTimeout(() => {
      firstStream.subscribe({
        next: (value) => {
          expect(value).toBe(1); // Should emit the first value even with a delay
          done();
        },
        error: (err) => done.fail(err),
        complete: () => {}
      });
    }, 100);
  });

  it('should emit the first value of the stream', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const firstStream = testStream.pipe(first());

    firstStream.subscribe({
      next: (value) => {
        expect(value).toBe(1); // Should emit the first value
        done();
      },
      error: (err) => done.fail(err),
    });
  });

  it('should not emit for an empty stream', (done) => {
    const testStream = from([]);
    const firstStream = testStream.pipe(first());

    firstStream.subscribe({
      next: () => {
        done.fail("Should not emit value");
      },
      error: (err) => expect(err.message).toBe("No elements in sequence"),
      complete: () => { done(); }
    });
  });

  it('should complete immediately after emitting the first value', (done) => {
    const testStream = from([10, 20, 30]);
    const firstStream = testStream.pipe(first());

    firstStream.subscribe({
      next: (value) => {
        expect(value).toBe(10); // Should emit only the first value
      },
      complete: () => {
        done(); // Should complete immediately after emitting the first value
      },
      error: (err) => done.fail(err),
    });
  });

  it('should not emit if no values match the predicate (if provided)', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const firstStream = testStream.pipe(first((value) => value > 5));

    firstStream.subscribe({
      next: () => {
        done.fail("should not emit value");
      },
      error: (err) => expect(err.message).toBe("No elements in sequence"),
      complete: () => { done(); }
    });
  });
});
