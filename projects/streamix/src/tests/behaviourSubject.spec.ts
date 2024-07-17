import { BehaviorSubject, Emission } from '../lib';

describe('BehaviorSubject', () => {
  it('should emit the current value to new subscribers immediately', async () => {
    const initialValue = 'initial_value';
    const behaviorSubject = new BehaviorSubject(initialValue);

    const emittedValues: any[] = [];
    const subscription = behaviorSubject.subscribe((emission: Emission) => {
      emittedValues.push(emission.value);
    });

    behaviorSubject.next('value1');
    behaviorSubject.complete();

    // Simulate a new subscriber after the value has been updated
    behaviorSubject.isStopped.then(() => {
      expect(emittedValues).toEqual([initialValue, 'value1']);
      subscription.unsubscribe();
    });
  });
});
