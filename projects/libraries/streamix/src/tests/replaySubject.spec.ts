import { createReplaySubject, createSemaphore, eachValueFrom } from '@actioncrew/streamix';

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



describe('Semaphore', () => {
  it('should acquire immediately if permits are available', async () => {
    const sem = createSemaphore(2);

    const release1 = await sem.acquire();
    const release2 = await sem.acquire();

    expect(release1).toBeInstanceOf(Function);
    expect(release2).toBeInstanceOf(Function);
  });

  it('should return null on tryAcquire if no permits are available', () => {
    const sem = createSemaphore(1);

    const r1 = sem.tryAcquire();
    const r2 = sem.tryAcquire();

    expect(r1).not.toBeNull();
    expect(r2).toBeNull();
  });

  it('should wait for permit if none available', async () => {
    const sem = createSemaphore(1);

    const release1 = await sem.acquire();
    let acquired = false;

    sem.acquire().then((release2) => {
      acquired = true;
      release2();
    });

    // Give a small delay to allow promise to attempt acquisition
    await new Promise((r) => setTimeout(r, 20));
    expect(acquired).toBeFalse();

    release1(); // release the first permit
    await new Promise((r) => setTimeout(r, 20));
    expect(acquired).toBeTrue();
  });

  it('should unblock multiple waiting acquire calls in order', async () => {
    const sem = createSemaphore(1);

    const order: number[] = [];

    const r1 = await sem.acquire();
    const p2 = sem.acquire().then((r) => {
      order.push(2);
      r();
    });
    const p3 = sem.acquire().then((r) => {
      order.push(3);
      r();
    });

    order.push(1);

    r1(); // release first
    await p2; // wait for second acquire to finish
    expect(order).toEqual([1, 2]);

    await p3; // wait for third acquire to finish
    expect(order).toEqual([1, 2, 3]);
  });

  it('tryAcquire should acquire permit if available after release', () => {
    const sem = createSemaphore(1);

    const r1 = sem.tryAcquire();
    expect(r1).not.toBeNull();

    r1!(); // release the permit
    const r2 = sem.tryAcquire();
    expect(r2).not.toBeNull();
  });

  it('release without waiting acquirers should increase available permits', async () => {
    const sem = createSemaphore(1);

    const r1 = sem.tryAcquire();
    expect(r1).not.toBeNull();

    r1!(); // release
    const r2 = sem.tryAcquire();
    expect(r2).not.toBeNull();
  });

  it('should handle concurrent acquire/release correctly', async () => {
    const sem = createSemaphore(2);
    const results: number[] = [];

    const p1 = sem.acquire().then((r) => {
      results.push(1);
      r();
    });
    const p2 = sem.acquire().then((r) => {
      results.push(2);
      r();
    });
    const p3 = sem.acquire().then((r) => {
      results.push(3);
      r();
    });

    await Promise.all([p1, p2, p3]);
    expect(results).toEqual([1, 2, 3]);
  });
});
