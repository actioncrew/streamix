import { createBehaviorSubject } from '../lib';

describe('BehaviorSubject', () => {
  it('should emit the current value to new subscribers immediately', (done) => {
    const initialValue = 'initial_value';
    const behaviorSubject = createBehaviorSubject(initialValue);

    const emittedValues: string[] = [];

    behaviorSubject.subscribe({
      next: (value: string) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([initialValue, 'value1', 'value2']);
        done();
      }
    });

    behaviorSubject.next('value1');
    behaviorSubject.next('value2');
    behaviorSubject.complete();
  });
});
