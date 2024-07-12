import { AbstractOperator, AbstractStream, Emission, StreamSink } from '../abstractions';
import { Promisified } from '../utils/promisified';

export class MergeMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private outerStream: AbstractStream;
  private activeInnerStreams: AbstractStream[] = [];
  private isProcessing = new Promisified<boolean>(false);
  private childSink: StreamSink;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
    this.outerStream = new AbstractStream();
    this.childSink = new StreamSink(this.outerStream);
    Object.assign(this.outerStream, {
      run: () => {
        return this.outerStream.isStopped.promise;
      }
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission | AbstractStream> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    try {
      return this.processEmission(emission, stream);
    } catch (error) {
      return Promise.reject(error); // Reject the outer promise on error
    }
  }

  private processEmission(emission: Emission, stream: AbstractStream) {
    if(stream instanceof StreamSink) {

      this.childSink.operators = stream.operators.slice(stream.currentOperator + 1); // Copy operators from current index to end
      this.childSink.subscribers = stream.subscribers;

      const innerStream = this.project(emission.value);
      this.activeInnerStreams.push(innerStream); // Track the active inner stream

      // Subscribe to inner stream and handle emissions
      const subscription = innerStream.subscribe(async (value) => {
        await this.childSink.emit({value});
      });

      innerStream.isFailed.promise.then((error) => {
        emission.error = error;
        emission.isFailed = true;
        subscription.unsubscribe();
        this.removeInnerStream(innerStream); // Remove inner stream on error
        this.checkIfAllStreamsStopped();
      });

      // Handle inner stream completion
      innerStream.isStopped.promise.then(() => {
        subscription.unsubscribe();
        this.removeInnerStream(innerStream);
        this.checkIfAllStreamsStopped();
      }).catch((error) => {
        emission.error = error;
        emission.isFailed = true;
        this.removeInnerStream(innerStream);
        this.checkIfAllStreamsStopped();
      });

    }

    // emission.isPhantom = true;
    // return emission;

    return this.childSink;
  }

  private removeInnerStream(innerStream: AbstractStream) {
    const index = this.activeInnerStreams.indexOf(innerStream);
    if (index !== -1) {
      this.activeInnerStreams.splice(index, 1);
    }
  }

  private checkIfAllStreamsStopped() {
    if (this.activeInnerStreams.length === 0) {
      this.outerStream.complete();
    }
  }
}

export function mergeMap(project: (value: any) => AbstractStream) {
  return new MergeMapOperator(project);
}
