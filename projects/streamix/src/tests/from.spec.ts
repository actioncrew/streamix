import { from } from '../lib';

describe('from function', () => {
  it('should emit values in sequence and complete', async () => {
    const values = [1, 2, 3];
    const stream = from(values);

    let emittedValues: any[] = [];
    const subscription = stream.subscribe((value) => {
      emittedValues.push(value);
    });

    stream.onStop.once(() => {
      expect(emittedValues).toEqual(values);
      expect(stream.isAutoComplete).toBe(true);

      subscription.unsubscribe();
    })
  });

  // it('should stop emitting values when stop is requested', async () => {
  //   const values = [1, 2, 3];
  //   const stream = from(values);

  //   let emittedValues: any[] = [];
  //   const subscription = stream.subscribe((value) => {
  //     emittedValues.push(value);
  //   });

  //   // Request stop after the first value
  //   setTimeout(() => {
  //     stream.stop();
  //   }, 10);

  //   expect(emittedValues).toEqual([1]); // Only the first value should be emitted
  //   expect(stream.isAutoComplete).toBe(true);

  //   subscription.unsubscribe();
  // });
});
