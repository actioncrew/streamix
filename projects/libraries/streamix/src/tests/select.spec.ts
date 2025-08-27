import { createSubject, eachValueFrom, select } from '@actioncrew/streamix';

describe('select operator tests', () => {
  let subject: any;
  let source: any;

  beforeEach(() => {
    subject = createSubject();
    source = subject;
  });

  it("should emit selected values based on indexIterator", async () => {
    const indexes = [0, 2, 4];
    const selectStream = source.pipe(select(indexes[Symbol.iterator]()));
    const results: any[] = [];

    // Create a promise that resolves when consumption is complete
    const consumptionPromise = (async () => {
      for await (const value of eachValueFrom(selectStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.next(4);
    subject.next(5);
    subject.complete();

    // Wait for the consumption to finish
    await consumptionPromise;

    expect(results).toEqual([1, 3, 5]); // Only values at indexes 0, 2, 4 should be emitted
  });

  it("should complete immediately if indexIterator is empty", async () => {
    const indexes: number[] = []; // Empty iterator, no indexes to select
    const selectStream = source.pipe(select(indexes[Symbol.iterator]()));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(selectStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([]); // No values should be emitted
  });

  it("should not emit values if indexIterator has indexes beyond the stream length", async () => {
    const indexes = [10, 11, 12]; // Indexes beyond the length of the stream
    const selectStream = source.pipe(select(indexes[Symbol.iterator]()));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(selectStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([]); // No values should be emitted
  });

  it("should emit only the valid values when indexIterator has mixed valid and invalid indexes", async () => {
    const indexes = [0, 2, 10]; // 10 is beyond the stream length
    const selectStream = source.pipe(select(indexes[Symbol.iterator]()));
    const results: any[] = [];

    (async () => {
      for await (const value of eachValueFrom(selectStream)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.next(3);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(results).toEqual([1, 3]); // Only values at indexes 0 and 2 should be emitted
  });
});
