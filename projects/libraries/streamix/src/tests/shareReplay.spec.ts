import { createStream, shareReplay } from '@actioncrew/streamix';

describe('shareReplay operator', () => {
  it('should replay last emitted value to new subscribers', done => {
    let executionCount = 0;

    const source = createStream<number>('source', async function* () {
      executionCount++;
      yield 42;
    });

    const shared$ = source.pipe(shareReplay());

    const values1: number[] = [];
    const values2: number[] = [];

    shared$.subscribe({
      next: val => values1.push(val),
      complete: () => {
        // Second subscription after complete
        shared$.subscribe({
          next: val => values2.push(val),
          complete: () => {
            expect(values1).toEqual([42]);
            expect(values2).toEqual([42]);
            expect(executionCount).toBe(1);
            done();
          },
          error: done.fail
        });
      },
      error: done.fail
    });
  });

  it('should propagate error to all subscribers', done => {
    const source = createStream<number>('erroring', async function* () {
      yield 1;
      throw new Error('Test error');
    });

    const shared$ = source.pipe(shareReplay());

    let errorCount = 0;
    let completed = false;
    shared$.subscribe({
      next: () => {},
      error: (err) => {
        expect(err).toEqual(new Error('Test error'));
        errorCount++;
      },
      complete: () => { if (errorCount === 2 && completed === false) { done(); completed = true; }},
    });

    shared$.subscribe({
      next: () => {},
      error: (err) => {
        expect(err).toEqual(new Error('Test error'));
        errorCount++;
      },
      complete: () => { if (errorCount === 2 && completed === false) { done(); completed = true; }},
    });
  });
});
