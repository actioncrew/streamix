import { createEmission, createStream, defer, Emission, eventBus, flags, Stream } from '../lib';

// Mocking Stream class
export function mockStream(emissions: Emission[], completed = false, failed = false, error?: Error): Stream {
  // Create the custom run function for the MockStream
  const stream = createStream(async (): Promise<void> => {
    if (failed && error) {
      eventBus.enqueue({ target: stream, payload: { error }, type: 'error' });
      return;
    }

    for (const emission of emissions) {
      if (stream[flags].isStopRequested) return; // Exit if stop is requested
      eventBus.enqueue({ target: stream, payload: { emission, source: stream }, type: 'emission' });
    }

    if (completed) {
      stream[flags].isAutoComplete = true; // Set auto-completion flag
    }
  });

  return stream;
}

describe('DeferStream', () => {
  it('should create a new stream each time it is subscribed to', (done) => {
    const emissions: Emission[] = [createEmission({ value: 1 }), createEmission({ value: 2 }), createEmission({ value: 3 })];
    const factory = jest.fn(() => mockStream(emissions, true));

    const deferStream = defer(factory);

    // Collect emissions from the deferred stream
    const collectedEmissions: Emission[] = [];
    const subscription = deferStream.subscribe({
      next: (value) => collectedEmissions.push(value),
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
    const factory = jest.fn(() => mockStream([], false, true, error));

    const deferStream = defer(factory);

    deferStream.subscribe({
      error: (e) => {
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
