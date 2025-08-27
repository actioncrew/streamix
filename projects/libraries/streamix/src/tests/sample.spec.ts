import { createSubject, eachValueFrom, sample } from '@actioncrew/streamix';

describe("sample operator", () => {
  let subject: any;

  beforeEach(() => {
    subject = createSubject<number>();
  });

  it("should emit the latest value at the specified interval", async () => {
    const period = 100;
    const sampled = subject.pipe(sample(period));
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(sampled)) {
        results.push(value);
      }
    })();

    subject.next(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    subject.next(2);
    await new Promise((resolve) => setTimeout(resolve, 125));
    subject.next(3);
    subject.complete();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(results).toEqual([2, 3]); // The latest values should be emitted
  });

  it("should complete when the source completes", async () => {
    const period = 100;
    const sampled = subject.pipe(sample(period));
    let completed = false;

    (async () => {
      for await (const _ of eachValueFrom(sampled)) {
        void _;
      }
      completed = true;
    })();

    subject.next(1);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(completed).toBeTrue();
  });

  it("should not emit anything if the source does not emit", async () => {
    const period = 100;
    const sampled = subject.pipe(sample(period));
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(sampled)) {
        results.push(value);
      }
    })();

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(results).toEqual([]); // No values emitted
  });

  it("should emit the last value even if the source completes early", async () => {
    const period = 100;
    const sampled = subject.pipe(sample(period));
    const results: number[] = [];

    (async () => {
      for await (const value of eachValueFrom(sampled)) {
        results.push(value);
      }
    })();

    subject.next(1);
    subject.next(2);
    subject.complete();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(results).toEqual([2]); // The last value before completion should be emitted
  });
});
