import { from, last } from "@actioncrew/streamix";

describe('last Operator', () => {
  it('should emit the last value of the stream', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const lastStream = testStream.pipe(last());

    lastStream.subscribe({
      next: (value) => {
        expect(value).toBe(4); // Should emit the last value
        done();
      },
      error: (err) => done.fail(err),
    });
  });

  it('should emit the last value even when there is a delay', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const lastStream = testStream.pipe(last());

    setTimeout(() => {
      lastStream.subscribe({
        next: (value) => {
          expect(value).toBe(4); // Should emit the last value even with a delay
          done();
        },
        error: (err) => done.fail(err),
      });
    }, 100);
  });

  it('should not emit for an empty stream', (done) => {
    const testStream = from([]);
    const lastStream = testStream.pipe(last());

    lastStream.subscribe({
      next: () => {
        done.fail("Should not emit for empty stream");
      },
      error: (err) => expect(err.message).toBe("No elements in sequence"),
      complete: () => { done(); }
    });
  });

  it('should emit the last value matching a predicate', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const lastStream = testStream.pipe(last((value) => value > 2));

    lastStream.subscribe({
      next: (value) => {
        expect(value).toBe(4); // Should emit the last value matching the predicate
        done();
      },
      error: (err) => done.fail(err),
    });
  });

  it('should not emit if no values match the predicate (if provided)', (done) => {
    const testStream = from([1, 2, 3, 4]);
    const lastStream = testStream.pipe(last((value) => value > 5));

    lastStream.subscribe({
      next: () => {
        done.fail("Should not emit for empty stream");
      },
      error: (err) => expect(err.message).toBe("No elements in sequence"),
      complete: () => { done(); }
    });
  });
});
