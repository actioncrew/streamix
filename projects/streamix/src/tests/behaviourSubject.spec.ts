import { createBehaviorSubject } from '../lib';

describe('BehaviorSubject', () => {
  it('should emit the current value to new subscribers immediately', async () => {
    const initialValue = 'initial_value';
    const behaviorSubject = createBehaviorSubject(initialValue);

    const emittedValues: any[] = [];
    const subscription = behaviorSubject.subscribe((value) => {
      emittedValues.push(value);
    });

    behaviorSubject.next('value1');

    // Simulate a new subscriber after the value has been updated
    behaviorSubject.onStop.once(() => {
      expect(emittedValues).toEqual([initialValue, 'value1']);
      subscription.unsubscribe();
    });

    behaviorSubject.complete();
  });
});
