import { createSubject, eachValueFrom, elementAt, elementNth } from '@actioncrew/streamix';

describe('elementNth and elementAt operator tests', () => {
  let subject: any;
  let source: any;

  beforeEach(() => {
    subject = createSubject();
    source = subject;
  });

  describe('elementNth', () => {
    it("should emit elements at the specified indices according to indexPattern", async () => {
      const indexPattern = (iteration: number) => (iteration === 0 ? 0 : iteration === 1 ? 2 : undefined); // 0, 2
      const nthStream = source.pipe(elementNth(indexPattern));
      const results: any[] = [];

      (async () => {
        for await (const value of eachValueFrom(nthStream)) {
          results.push(value);
        }
      })();

      subject.next(1);
      subject.next(2);
      subject.next(3);
      subject.next(4);
      subject.complete();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(results).toEqual([1, 3]); // Only values at indexes 0 and 2 should be emitted
    });

    it("should complete immediately if indexPattern returns no valid indices", async () => {
      const indexPattern = () => undefined; // No valid indices
      const nthStream = source.pipe(elementNth(indexPattern));
      const results: any[] = [];

      (async () => {
        for await (const value of eachValueFrom(nthStream)) {
          results.push(value);
        }
      })();

      subject.next(1);
      subject.next(2);
      subject.complete();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(results).toEqual([]); // No values should be emitted
    });
  });

  describe('elementAt', () => {
    it("should emit the value at the specified index", async () => {
      const index = 2; // Selecting element at index 2
      const elementAtStream = source.pipe(elementAt(index));
      const results: any[] = [];

      (async () => {
        for await (const value of eachValueFrom(elementAtStream)) {
          results.push(value);
        }
      })();

      subject.next(1);
      subject.next(2);
      subject.next(3); // Index 2 corresponds to this value
      subject.next(4);
      subject.complete();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(results).toEqual([3]); // Only the element at index 2 should be emitted
    });

    it("should complete immediately if the index is out of bounds", async () => {
      const index = 10; // Out of bounds
      const elementAtStream = source.pipe(elementAt(index));
      const results: any[] = [];

      (async () => {
        for await (const value of eachValueFrom(elementAtStream)) {
          results.push(value);
        }
      })();

      subject.next(1);
      subject.next(2);
      subject.complete();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(results).toEqual([]); // No value should be emitted as the index is out of bounds
    });
  });
});
