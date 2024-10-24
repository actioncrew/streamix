import { Emission, iif, from } from '../lib';


describe('iif operator', () => {
  it('should choose trueStream when condition is true', (done) => {
    const condition = (emission: Emission) => emission.value > 5;
    const trueStream = from([10, 20, 30]);
    const falseStream = from([1, 2, 3]);

    const operator = from([10]).pipe(iif(condition, trueStream, falseStream));
    const result: any[] = [];

    const subscription = operator.subscribe((value) => {
      result.push(value);
    });

    operator.onStop.once(() => {
      expect(result).toEqual([10, 20, 30]);
      subscription.unsubscribe();
      done();
    });
  });

  it('should choose falseStream when condition is false', (done) => {
    const condition = (emission: Emission) => emission.value > 5;
    const trueStream = from([10, 20, 30]);
    const falseStream = from([1, 2, 3]);

    const operator = from([2]).pipe(iif(condition, trueStream, falseStream));
    const result: any[] = [];

    const subscription = operator.subscribe((value) => {
      result.push(value);
    });

    operator.onStop.once(() => {
      expect(result).toEqual([1, 2, 3]);
      subscription.unsubscribe();
      done();
    });
  });
});
