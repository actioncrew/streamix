import { Subject } from '../../lib';
import { Emission, Operator, Subscribable } from '../abstractions';
import { promisifiedCounter } from '../utils';

export class MergeMapOperator extends Operator {
  private readonly project: (value: any) => Subscribable;
  private outerStream = new Subject();
  private activeInnerStreams: Subscribable[] = [];
  private processingPromises: Promise<void>[] = [];

  private input?: Subscribable;
  private output?: Subject;

  private emissionNumber = 0;
  private executionNumber = promisifiedCounter(0);

  constructor(project: (value: any) => Subscribable) {
    super();
    this.project = project;

    // Handle events for the outer stream
    this.outerStream.isCancelled.then(() => {
      this.stopAllStreams();
    });

    this.outerStream.isFailed.then((error) => {
      console.warn('Outer stream failed:', error);
      this.stopAllStreams();
    });

    this.outerStream.isStopped.then(() => {
      this.stopAllStreams();
    });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    this.emissionNumber++;
    this.output = this.output || this.outerStream;

    if (!this.input) {
      this.input = stream;
      this.input.isStopped.then(() => this.executionNumber.waitFor(this.emissionNumber).then(() => this.output?.complete()));
    }

    // Start processing the emission in parallel
    this.processEmission(emission, this.output!);

    // Return the phantom emission immediately
    emission.isPhantom = true;
    return emission;
  }

  private async processEmission(emission: Emission, stream: Subject): Promise<void> {
    if (await this.checkAndStopStream(stream, emission)) {
        return;
    }

    const innerStream = this.project(emission.value);
    this.activeInnerStreams.push(innerStream);

    let completionPromise = Promise.resolve();
    const processingPromise = new Promise<void>((resolve) => {
    const promises: Set<Promise<void>> = new Set();

    const handleCompletion = async () => {
      completionPromise = completionPromise.then(async () => {
        let snapshot = Array.from(promises);
        promises.clear(); await Promise.all(snapshot);
        this.executionNumber.increment();
        this.removeInnerStream(innerStream);

        this.processingPromises = this.processingPromises.filter(p => p !== processingPromise);
        resolve();
      });
      await completionPromise;
    };

      const subscription = innerStream.subscribe((value) => {
        // Gather promises from stream.next() to ensure parallel processing
        promises.add(
          stream.next(value).catch((error) => {
            emission.error = error;
            emission.isFailed = true;
          })
        );
      });

      innerStream.isCancelled.then(() => {
        emission.isCancelled = true;
        subscription.unsubscribe();
        handleCompletion();
      });

      innerStream.isFailed.then((error) => {
        emission.error = error;
        emission.isFailed = true;
        subscription.unsubscribe();
        handleCompletion();
      });

      innerStream.isStopped
        .then(() => {
          subscription.unsubscribe();
          emission.isComplete = true;
          handleCompletion();
        })
        .catch((error) => {
          emission.error = error;
          emission.isFailed = true;
          handleCompletion();
        });
    });

    this.processingPromises.push(processingPromise);

    processingPromise.finally(() => {
      if (stream.shouldTerminate() || stream.shouldComplete()) {
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

  private checkAndStopStream(stream: Subscribable, emission: Emission): boolean {
    if (stream.isCancelled()) {
      emission.isCancelled = true;
      this.stopAllStreams();
      return true;
    }
    return false;
  }
}

export const mergeMap = (project: (value: any) => Subscribable) => new MergeMapOperator(project);
