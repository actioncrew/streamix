import { defer, Emission, Stream } from '../lib';

// Mocking Stream class
class MockStream extends Stream {
  private emissions: Emission[] = [];
  private completed = false;
  private failed = false;
  private error?: Error;

  constructor(emissions: Emission[], completed = false, failed = false, error?: Error) {
    super();
    this.emissions = emissions;
    this.completed = completed;
    this.failed = failed;
    this.error = error;
  }

  async run(): Promise<void> {
    if (this.failed && this.error) {
      this.onError.process({error: this.error});
      return;
    }

    for (const emission of this.emissions) {
      if (this.isStopRequested()) return;
      await this.onEmission.process({emission, source: this});
    }

    if (this.completed) {
      this.isAutoComplete.resolve(true);
    }
  }
}

describe('DeferStream', () => {
  it('should create a new stream each time it is subscribed to', (done) => {
    const emissions: Emission[] = [{ value: 1 }, { value: 2 }, { value: 3 }];
    const factory = jest.fn(() => new MockStream(emissions, true));

    const deferStream = defer(factory);

    // Collect emissions from the deferred stream
    const collectedEmissions: Emission[] = [];
    const subscription = deferStream.subscribe(async (value) => {
      collectedEmissions.push(value);
    });

    deferStream.onStop.once(() => {
      expect(factory).toHaveBeenCalled(); // Check if factory was called
      expect(collectedEmissions).toHaveLength(3); // Verify all emissions are collected
      expect(collectedEmissions).toEqual([1, 2, 3]); // Check emission values

      subscription.unsubscribe();
      done()
    });
  });

  it('should handle stream completion', (done) => {
    const factory = jest.fn(() => new MockStream([], true));

    const deferStream = defer(factory);

    deferStream.subscribe();

    deferStream.onStop.once(() => {
      expect(factory).toHaveBeenCalled();
      done();
    })
  });

  it('should handle stream errors', async () => {
    const error = new Error('Test Error');
    const factory = jest.fn(() => new MockStream([], false, true, error));

    const deferStream = defer(factory);

    const failure = new Promise<void>((resolve, reject) => {
      (deferStream as any).callback = ((e: any) => {
        if (e === error) resolve();
        else reject('Expected error not received');
      });
      deferStream.onError.chain(deferStream, (deferStream as any).callback);
    });

    deferStream.subscribe();
    deferStream.onStop.once(async () => {
      expect(factory).toHaveBeenCalled();
      await failure; // Ensure the error is properly handled
    })
  });
});
