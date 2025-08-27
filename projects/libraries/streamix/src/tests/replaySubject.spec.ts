import { createReplaySubject, eachValueFrom } from '@actioncrew/streamix';

describe('ReplaySubject', () => {
  it('should emit values to subscribers in real-time as well as replay buffered values', async () => {
    const subject = createReplaySubject<number>(2);

    subject.next(1);
    subject.next(2);

    const receivedA: number[] = [];
    const subA = subject.subscribe(v =>
      receivedA.push(v)
    );

    subject.next(3); // Both buffer and live delivery

    const receivedB: number[] = [];
    const subB = subject.subscribe(v => receivedB.push(v));

    subject.next(4); // Both subA and subB get this

    await new Promise(resolve => setTimeout(resolve, 10)); // Let async delivery finish

    subA.unsubscribe();
    subB.unsubscribe();

    expect(receivedA).toEqual([1, 2, 3, 4]);
    expect(receivedB).toEqual([2, 3, 4]);
  });

  it('should replay all values to late subscribers when bufferSize is Infinity', async () => {
    const subject = createReplaySubject<number>();

    subject.next(1);
    subject.next(2);
    subject.next(3);

    const result: number[] = [];
    for await (const value of eachValueFrom(subject)) {
      result.push(value);
      if (result.length === 3) break;
    }

    expect(result).toEqual([1, 2, 3]);
  });

  it('should replay last N values when bufferSize is set', async () => {
    const subject = createReplaySubject<number>(2);

    subject.next(1);
    subject.next(2);
    subject.next(3); // buffer = [2, 3]

    const result: number[] = [];
    for await (const value of eachValueFrom(subject)) {
      result.push(value);
      if (result.length === 2) break;
    }

    expect(result).toEqual([2, 3]);
  });

  it('should complete all subscribers when last unsubscribes', (done) => {
    const subject = createReplaySubject<number>();
    const received: number[] = [];

    const sub = subject.subscribe({
      next: v => received.push(v),
      complete: () => done(),
    });

    subject.next(1);
    subject.next(2);

    sub.unsubscribe();
  });

  it('should not emit values after completion', async () => {
    const subject = createReplaySubject<number>(3);
    const result: number[] = [];

    subject.next(1);
    subject.next(2);
    subject.complete();

    const sub = subject.subscribe(v => result.push(v));
    subject.next(3); // Should not be delivered

    await new Promise(resolve => setTimeout(resolve, 10));
    sub.unsubscribe();

    expect(result).toEqual([1, 2]);
  });

  it('should replay only the buffered items to multiple subscribers', async () => {
    const subject = createReplaySubject<number>(1);
    subject.next(5);
    subject.next(6); // buffer = [6]

    const result1: number[] = [];
    const result2: number[] = [];

    const sub1 = subject.subscribe(v => result1.push(v));
    const sub2 = subject.subscribe(v => result2.push(v));

    await new Promise(resolve => setTimeout(resolve, 10));

    sub1.unsubscribe();
    sub2.unsubscribe();

    expect(result1).toEqual([6]);
    expect(result2).toEqual([6]);
  });
});
