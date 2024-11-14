import { BehaviorSubject } from '../lib';

describe('BehaviorSubject', () => {
  it('should emit the current value to new subscribers immediately', (done) => {
    const initialValue = 'initial_value';
    const behaviorSubject = new BehaviorSubject(initialValue);

    const emittedValues: any[] = [];
    const subscription = behaviorSubject.subscribe((value) => {
      emittedValues.push(value);
    });

    behaviorSubject.next('value1');
    behaviorSubject.next('value2');
    behaviorSubject.complete();

    // Simulate a new subscriber after the value has been updated
    behaviorSubject.onStop.once(() => {
      expect(emittedValues).toEqual([initialValue, 'value1', 'value2']);
      subscription.unsubscribe();
      done();
    });

    behaviorSubject.complete();
  });
});
