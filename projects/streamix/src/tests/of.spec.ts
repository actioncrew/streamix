import { OfStream } from '../lib';

describe('OfStream', () => {
  it('should emit the given value', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    const emittedValues: any[] = [];
    const subscription = ofStream.subscribe((value) => {
      emittedValues.push(value);
    });

    ofStream.onStop.once(() => {
      expect(emittedValues).toEqual([value]);
      subscription.unsubscribe();
    })
  });

  it('should complete after emitting the value', (done) => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    let isComplete = false;
    ofStream.subscribe(() => {
      isComplete = true;
    });

    ofStream.onStop.once(() => {
      expect(isComplete).toBe(true);
      done();
    })
  });

  it('should not emit value if unsubscribed before run', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    const emittedValues: any[] = [];
    const subscription = ofStream.subscribe((value) => {
      emittedValues.push(value);
    });

    subscription.unsubscribe();

    expect(emittedValues).toEqual([]);
  });

  it('should not emit value if cancelled before run', async () => {
    const value = 'test_value';
    const ofStream = new OfStream(value);

    const emittedValues: any[] = [];
    ofStream.subscribe((value) => {
      emittedValues.push(value);
    });

    ofStream.complete();
    await ofStream.run();

    expect(emittedValues).toEqual([]);
  });
});
