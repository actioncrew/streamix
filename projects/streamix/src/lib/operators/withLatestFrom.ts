import { Emission, Operator, Subscribable } from '../abstractions';
import { asyncValue } from '../utils';

export class WithLatestFromOperator extends Operator {
  private latestValues: ReturnType<typeof asyncValue<any>>[] = [];
  private streams: Subscribable[];
  private handleEmissionFns: Array<(event: { emission: Emission; source: Subscribable }) => void> = [];

  constructor(...streams: Subscribable[]) {
    super();
    this.streams = streams;

    this.streams.forEach((stream, index) => {
      const latestValue = asyncValue();
      this.latestValues.push(latestValue);

      // Register the emission handler
      this.handleEmissionFns.push(async ({ emission }: { emission: Emission }) => {
        latestValue.set(emission.value);
      });

      stream.onEmission.chain(this, this.handleEmissionFns[index]);
      stream.start(); // Start the stream
    });
  }

  override init(stream: Subscribable) {
    // Cleanup on stream termination
    stream.isCancelled.then(() => this.cleanup());
    stream.isFailed.then(() => this.cleanup());
    stream.isStopped.then(() => this.cleanup());
  }

  override async cleanup() {
    // Remove emission handlers for each stream
    this.streams.forEach((stream, index) => {
      if(stream.isStopped()) {
        stream.onEmission.remove(this, this.handleEmissionFns[index]);
      }
    });

    // Reset latest values and handlers
    this.latestValues = [];
    this.handleEmissionFns = [];
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if(stream.shouldComplete() || stream.shouldTerminate()) {
      await Promise.all(this.streams.map(stream => stream.complete()));
    }

    const latestValuesPromise = Promise.all(this.latestValues.map(async (value) => await value()));
    const terminationPromises = Promise.race([
      stream.awaitCompletion(), stream.awaitTermination(),
      ...this.streams.map(source => source.awaitCompletion()),
      ...this.streams.map(source => source.awaitTermination())
    ]);

    await Promise.race([latestValuesPromise, terminationPromises]);

    if (this.latestValues.every((value) => value.hasValue())) {
      emission.value = [emission.value, ...this.latestValues.map(value => value.value())];
    } else {
      emission.isFailed = true;
      emission.error = new Error("Some streams are terminated without emitting value.");
      this.cleanup();
    }

    return emission;
  }
}

export const withLatestFrom = (...streams: Subscribable[]) => new WithLatestFromOperator(...streams);
