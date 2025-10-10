import { of } from '@actioncrew/streamix';

describe('of', () => {
  it('should emit the given value', (done) => {
    const value = 'test_value';
    const ofStream = of(value);

    const emittedValues: any[] = [];
    ofStream.subscribe({
      next: (v) => emittedValues.push(v),
      complete: () => {
        expect(emittedValues).toEqual([value]);
        done(); // tells Jasmine the async test is done
      },
      error: (err) => done.fail(err)
    });
  });

  it('should complete after emitting the value', (done) => {
    const value = 'test_value';
    const ofStream = of(value);

    let isComplete = false;
    ofStream.subscribe({
      next: () => isComplete = true,
      complete: () => {
        expect(isComplete).toBe(true);
        done();
      }
    })
  });

  it('should not emit value if unsubscribed before run', async () => {
    const value = 'test_value';
    const ofStream = of(value);

    const emittedValues: any[] = [];
    const subscription = ofStream.subscribe((value: any) => {
      emittedValues.push(value);
    });

    subscription.unsubscribe();

    expect(emittedValues).toEqual([]);
  });
});
