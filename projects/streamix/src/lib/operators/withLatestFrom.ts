import { Emission, Operator, Stream, Subscribable } from '../abstractions';
import { asyncValue } from '../utils';

export class WithLatestFromOperator extends Operator {
  private readonly streams: Subscribable[];

  private latestValues!: ReturnType<typeof asyncValue<any>>[];
  private handleEmissionFns!: Array<(event: { emission: Emission; source: Subscribable }) => void>;
  private input!: Stream;
  private started!: boolean;

  constructor(...streams: Subscribable[]) {
    super();
    this.streams = streams;
  }

  override init(stream: Stream) {
    this.latestValues = [];
    this.handleEmissionFns = [];
    this.input = stream;
    this.started = false;

    this.streams.forEach((source, index) => {
      const latestValue = asyncValue();
      this.latestValues.push(latestValue);

      // Register the emission handler
      this.handleEmissionFns.push(async ({ emission }: { emission: Emission }) => {
        latestValue.set(emission.value);
      });

      source.onEmission.chain(this, this.handleEmissionFns[index]);
    });

    // Cleanup on stream termination
    stream.onStop.once(() => this.finalize());
  }

  async finalize() {
    // Remove emission handlers for each stream
    this.streams.forEach((stream, index) => {
      if(stream.isStopped) {
        stream.onEmission.remove(this, this.handleEmissionFns[index]);
      }
    });

    // Reset latest values and handlers
    this.latestValues = [];
    this.handleEmissionFns = [];
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if(!this.started) {
      this.started = true;
      this.streams.forEach(source => source.subscribe());
    }

    if(stream.shouldComplete()) {
      await Promise.all(this.streams.map(source => source.complete()));
    }

    const latestValuesPromise = Promise.all(this.latestValues.map(async (value) => await value()));
    const terminationPromises = Promise.race([
      stream.awaitCompletion(),
      ...this.streams.map(source => source.awaitCompletion()),
    ]);

    await Promise.race([latestValuesPromise, terminationPromises]);

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
