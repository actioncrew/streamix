import { CounterType } from './../utils/counter';
import { Subject } from '../../lib';
import { Emission, Operator, StreamOperator, Subscribable } from '../abstractions';
import { counter } from '../utils';

export class MergeMapOperator extends Operator implements StreamOperator {
  private output!: Subject;
  private activeInnerStreams!: Subscribable[];
  private processingPromises!: Promise<void>[];

  private input!: Subscribable;

  private emissionNumber!: number;
  private executionNumber!: CounterType;
  private handleInnerEmission!: (({ emission, source }: any) => Promise<void>) | null;
  private inputStoppedPromise!: Promise<void>;
  private outputStoppedPromise!: Promise<void>;

  constructor(private readonly project: (value: any) => Subscribable) {
    super();
    this.project = project;
  }

  get stream() {
    return this.output;
  }

  override init(stream: Subscribable) {
    this.output = new Subject();
    this.activeInnerStreams = [];
    this.processingPromises = [];
    this.input = stream;
    this.emissionNumber = 0;
    this.executionNumber = counter(0);
    this.handleInnerEmission = null;

    this.inputStoppedPromise = this.input.isStopped.then(() =>
      this.executionNumber.waitFor(this.emissionNumber)
        .then(() => this.output?.complete())
    );

    this.outputStoppedPromise = this.output.isStopped.then(() => this.stopAllStreams());
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.emissionNumber++;

    // Process the emission in parallel with other emissions
    this.processEmission(emission, this.output!);

    // Return the phantom emission immediately
    emission.isPhantom = true;
    return emission;
  }

  private async processEmission(emission: Emission, stream: Subject): Promise<void> {
    const innerStream = this.project(emission.value);
    this.activeInnerStreams.push(innerStream);

    const processingPromise = new Promise<void>((resolve) => {
      const promises: Set<Promise<void>> = new Set();

      const handleCompletion = async () => {
        await Promise.all(promises);
        this.executionNumber.increment();
        this.removeInnerStream(innerStream);

        this.processingPromises = this.processingPromises.filter(p => p !== processingPromise);
        resolve();
      };

      // Use the onEmission hook to subscribe to inner stream emissions
      if (!this.handleInnerEmission) {
        this.handleInnerEmission = async ({ emission: innerEmission }: any) => {
          // Gather promises from stream.next() to ensure parallel processing
          promises.add(
            stream.next(innerEmission.value).catch((error) => {
              emission.error = error;
              emission.isFailed = true;
            })
          );
        };
      }

      innerStream.onEmission.chain(this, this.handleInnerEmission);

      innerStream.onError.once((error: any) => {
        emission.error = error;
        emission.isFailed = true;
        innerStream.onEmission.remove(this, this.handleInnerEmission!);
        handleCompletion();
      });

      innerStream.isStopped
        .then(() => {
          innerStream.onEmission.remove(this, this.handleInnerEmission!);
          handleCompletion();
        })
        .catch((error) => {
          emission.error = error;
          emission.isFailed = true;
          handleCompletion();
        });

      // Start the inner stream to ensure it begins emitting values
      innerStream.start();
    });

    this.processingPromises.push(processingPromise);

    processingPromise.finally(() => {
      if (stream.shouldComplete()) {
        this.stopAllStreams();
      }
    });
  }

  private removeInnerStream(innerStream: Subscribable) {
    const index = this.activeInnerStreams.indexOf(innerStream);
    if (index !== -1) {
      this.activeInnerStreams.splice(index, 1);
    }
  }

  private async stopAllStreams() {
    await Promise.all(this.activeInnerStreams.map(async (stream) => {
      await stream.complete();
    }));
    this.activeInnerStreams = [];
    await this.stopInputStream();
    await this.stopOutputStream();
  }

  private async stopInputStream() {
    if (this.input) {
      await this.input.complete();
    }
  }

  private async stopOutputStream() {
    if (this.output) {
      await this.output.complete();
    }
  }
}

export const mergeMap = (project: (value: any) => Subscribable) => new MergeMapOperator(project);
