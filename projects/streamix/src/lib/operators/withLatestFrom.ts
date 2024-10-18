import { Emission, Operator, Stream, Subscribable } from '../abstractions';
import { asyncValue } from '../utils';

export class WithLatestFromOperator extends Operator {
  private readonly streams: Subscribable[];

  private latestValues!: ReturnType<typeof asyncValue<any>>[];
  private handleEmissionFns!: Array<(event: { emission: Emission; source: Subscribable }) => void>;
  private input!: Stream;

  constructor(...streams: Subscribable[]) {
    super();
    this.streams = streams;
  }

  override init(stream: Stream) {
    this.latestValues = [];
    this.handleEmissionFns = [];
    this.input = stream;

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

    // Cleanup on stream termination
    stream.isStopped.then(() => this.finalize());
  }

  async finalize() {
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
    if(stream.shouldComplete()) {
      await Promise.all(this.streams.map(stream => stream.complete()));
    }

    const latestValuesPromise = Promise.all(this.latestValues.map(async (value) => await value()));
    const terminationPromises = Promise.race([
      ...this.streams.map(source => source.awaitCompletion()),
    ]);

    await Promise.race([latestValuesPromise, terminationPromises, stream.awaitCompletion()]);

    if (this.latestValues.every((value) => value.hasValue())) {
      emission.value = [emission.value, ...this.latestValues.map(value => value.value())];
    } else {
      emission.isFailed = true;
      emission.error = new Error("Some streams are completed without emitting value.");
      this.finalize();
    }

    return emission;
  }
}

export const withLatestFrom = (...streams: Subscribable[]) => new WithLatestFromOperator(...streams);
