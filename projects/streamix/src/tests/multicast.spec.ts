import { from, hooks, map, multicast } from '../lib'; // Adjust the import path as needed

describe('multicast', () => {
  test('should multicast values to multiple subscribers', (done) => {
    const source = from([1, 2, 3]).pipe(map(value => value + 1));
    const multicastPipeline = multicast(source);

    const values: number[] = [];

    multicastPipeline.subscribe(value => values.push(value));
    multicastPipeline.subscribe(value => values.push(value));

    multicastPipeline[hooks].onStop.once(() => {
      expect(values).toEqual([2, 2, 3, 3, 4, 4]);
      done();
    })
  });

  test('should only subscribe to the source once', (done) => {
    const source = jest.fn().mockReturnValue(from([1, 2, 3]).pipe(map(value => value + 1)));
    const multicastPipeline = multicast(source());

    const values: number[] = [];

    multicastPipeline.subscribe((value) => values.push(value as number));
    multicastPipeline.subscribe(value => values.push(value as number));

    multicastPipeline[hooks].onStop.once(() => {
      expect(source).toHaveBeenCalledTimes(1); // The source should be called only once
      expect(values).toEqual([2, 2, 3, 3, 4, 4]);
      done();
    })
  });

  test('should not emit after all subscribers unsubscribe', (done) => {
    const source = from([1, 2, 3]).pipe(map(value => value + 1));
    const multicastPipeline = multicast(source);

    const values: number[] = [];

    const sub1 = multicastPipeline.subscribe(value => values.push(value));
    const sub2 = multicastPipeline.subscribe(value => values.push(value));

    // Unsubscribe both subscribers
    sub1.unsubscribe();
    sub2.unsubscribe();

    // Emit again to check if no more values are emitted
    multicastPipeline.subscribe({
      next: value => values.push(value),
      complete: () => {
        expect(values).toEqual([]); // Should not add any new values
        done();
      }
    });
  });
});
