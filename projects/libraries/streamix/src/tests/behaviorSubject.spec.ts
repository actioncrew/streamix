import { createBehaviorSubject } from '@actioncrew/streamix';

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

  it('should always expose the latest value via the async getValue() method', async () => {
    const initial = 42;
    const behaviorSubject = createBehaviorSubject(initial);

    // Immediately after creation, getValue() resolves to the initial value
    expect(behaviorSubject.snappy).toBe(42);

    // After next(), getValue() resolves to the updated value
    behaviorSubject.next(100);
    expect(behaviorSubject.snappy).toBe(100);

    behaviorSubject.next(999);
    expect(behaviorSubject.snappy).toBe(999);

    // Completing should not change the last value
    behaviorSubject.complete();
    expect(behaviorSubject.snappy).toBe(999);
  });
});
