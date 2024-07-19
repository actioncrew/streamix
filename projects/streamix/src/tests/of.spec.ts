import { OfStream } from '../lib';

describe('OfStream', () => {
  it('should emit the given value', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    const emittedValues: any[] = [];
    const subscription = ofStream.subscribe((emission) => {
      emittedValues.push(emission.value);
    });

    ofStream.isStopped.then(() => {
      expect(emittedValues).toEqual([value]);
      subscription.unsubscribe();
    })
  });

  it('should complete after emitting the value', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    let isComplete = false;
    ofStream.isAutoComplete.promise.then(() => {
      isComplete = true;
    });

    await ofStream.run();

    expect(isComplete).toBe(true);
  });

  it('should not emit value if unsubscribed before run', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    const emittedValues: any[] = [];
    const subscription = ofStream.subscribe((emission) => {
      emittedValues.push(emission.value);
    });

    subscription.unsubscribe();

    expect(emittedValues).toEqual([]);
  });

  it('should not emit value if cancelled before run', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    const emittedValues: any[] = [];
    ofStream.subscribe((emission) => {
      emittedValues.push(emission.value);
    });

    ofStream.terminate();
    await ofStream.run();

    expect(emittedValues).toEqual([]);
  });

  it('should resolve isAutoComplete if unsubscribed before run', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    let isComplete = false;
    ofStream.isAutoComplete.promise.then(() => {
      isComplete = true;
    });

    const subscription = ofStream.subscribe(() => {});
    subscription.unsubscribe();

    expect(isComplete).toBe(true);
  });
});
