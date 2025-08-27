import { eachValueFrom, loop, StreamGenerator } from '@actioncrew/streamix';

function collect<T>(stream: StreamGenerator<T>): Promise<T[]> {
  const result: T[] = [];
  return (async () => {
    for await (const v of stream) {
      result.push(v);
    }
    return result;
  })();
}

describe('loop operator', () => {
  it('should emit a sequence of values while the condition is true', async () => {
    const result = await collect(eachValueFrom(loop(0, x => x < 5, x => x + 1)));
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it('should emit nothing if condition is false initially', async () => {
    const result = await collect(eachValueFrom(loop(10, x => x < 5, x => x + 1)));
    expect(result).toEqual([]);
  });

  it('should stop emitting after unsubscribe', async () => {
    const stream = loop(0, x => x < 10, x => x + 1);
    const emitted: number[] = [];

    const sub = stream.subscribe(value => {
      emitted.push(value);
      if (value === 3) {
        sub.unsubscribe();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(emitted).toEqual([0, 1, 2, 3]);
  });

  it('should work with async for-await-of iteration', async () => {
    const stream = loop(1, x => x <= 3, x => x * 2); // 1, 2, 4 (stops)
    const values: number[] = [];

    for await (const v of eachValueFrom(stream)) {
      values.push(v);
    }

    expect(values).toEqual([1, 2]);
  });

  it('should allow multiple subscriptions with independent state', async () => {
    const s1 = loop(0, x => x < 3, x => x + 1);
    const s2 = loop(10, x => x < 13, x => x + 1);

    const [r1, r2] = await Promise.all([
      collect(eachValueFrom(s1)),
      collect(eachValueFrom(s2))
    ]);

    expect(r1).toEqual([0, 1, 2]);
    expect(r2).toEqual([10, 11, 12]);
  });
});
