import { createStream, eachValueFrom, partition } from '@actioncrew/streamix';

describe('partition operator', () => {

  async function collect<T>(source: any): Promise<{ true: T[]; false: T[] }> {
    const trueValues: T[] = [];
    const falseValues: T[] = [];

    for await (const { key, value } of eachValueFrom(source)) {
      if (key === "true") {
        trueValues.push(value);
      } else {
        falseValues.push(value);
      }
    }

    return { true: trueValues, false: falseValues };
  }

  it('should split values based on predicate', async () => {
    const source = createStream<number>("source", async function* () {
      yield 1;
      yield 2;
      yield 3;
      yield 4;
    });

    const partitioned = source.pipe(partition(n => n % 2 === 0));
    const { true: evens, false: odds } = await collect<number>(partitioned);

    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3]);
  });

  it('should handle empty source stream', async () => {
    const source = createStream<number>("test", async function* () {});

    const partitioned = source.pipe(partition(() => true));
    const { true: yes, false: no } = await collect<number>(partitioned);

    expect(yes).toEqual([]);
    expect(no).toEqual([]);
  });

  it('should handle all passing the predicate', async () => {
    const source = createStream<number>("test", async function* () {
      yield 1;
      yield 2;
    });

    const partitioned = source.pipe(partition(n => n > 0));
    const { true: pass, false: fail } = await collect<number>(partitioned);

    expect(pass).toEqual([1, 2]);
    expect(fail).toEqual([]);
  });

  it('should handle all failing the predicate', async () => {
    const source = createStream<number>("test", async function* () {
      yield -1;
      yield -2;
    });

    const partitioned = source.pipe(partition(n => n > 0));
    const { true: pass, false: fail } = await collect<number>(partitioned);

    expect(pass).toEqual([]);
    expect(fail).toEqual([-1, -2]);
  });

  it('should propagate errors from source', done => {
    const source = createStream<number>("test", async function* () {
      yield 1;
      yield 2;
      throw new Error('Test error');
    });

    const partitioned = source.pipe(partition(n => n % 2 === 0));

    partitioned.subscribe({
      next: () => {
        // do nothing
      },
      error: (err) => {
        expect(err).toEqual(new Error('Test error'));

      },
      complete: () => {
        done();
      }
    });
  });
});
