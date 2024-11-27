import { createBehaviorSubject } from '../lib';

describe('BehaviorSubject', () => {
  it('should emit the current value to new subscribers immediately', (done) => {
    const initialValue = 'initial_value';
    const behaviorSubject = createBehaviorSubject(initialValue);

    const emittedValues: any[] = [];
    const subscription = behaviorSubject.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([initialValue, 'value1', 'value2']);
        subscription.unsubscribe();
        done();
      }
    });

    behaviorSubject.next('value1');
    behaviorSubject.next('value2');
    behaviorSubject.complete();
  });
});
