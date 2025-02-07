import { createSubject, defer, Emission, Stream } from '../lib';

// Mocking Stream class
export function mockStream(values: any[], completed = false, error?: Error): Stream<any> {
  // Create the Subject stream for the mock
  const subject = createSubject<any>();

  // Simulate async behavior using setTimeout or similar
  setTimeout(() => {
    if (error) {
      subject.error(error);
      return;
    }

    // Emit all values
    values.forEach(value => subject.next(value));

    // Complete if the completed flag is true
    if (completed) {
      subject.complete();
    }
  }, 0); // Simulate asynchronous behavior

  return subject;
}


describe('DeferStream', () => {
  it('should create a new stream each time it is subscribed to', (done) => {
    const emissions: any[] = [1, 2, 3];
    const factory = jest.fn(() => mockStream(emissions, true));

    const deferStream = defer(factory);

    // Collect emissions from the deferred stream
    const collectedEmissions: Emission[] = [];
    const subscription = deferStream.subscribe({
      next: (value: any) => collectedEmissions.push(value),
      complete: () => {
        expect(factory).toHaveBeenCalled(); // Check if factory was called
        expect(collectedEmissions).toHaveLength(3); // Verify all emissions are collected
        expect(collectedEmissions).toEqual([1, 2, 3]); // Check emission values

        subscription.unsubscribe();
        done()
      }
    });
  });

  it('should handle stream completion', (done) => {
    const factory = jest.fn(() => mockStream([], true));

    const deferStream = defer(factory);

    deferStream.subscribe({
      complete: () => {
        expect(factory).toHaveBeenCalled();
        done();
      }
    });
  });

  it('should handle stream errors', async () => {
    const error = new Error('Test Error');
    const factory = jest.fn(() => mockStream([], false, error));

    const deferStream = defer(factory);

    deferStream.subscribe({
      error: (e: Error) => {
        if (e !== error)  {
          throw new Error('Expected error not received');
        }
      },
      complete: () => {
        expect(factory).toHaveBeenCalled();
      }
    });
  });
});
