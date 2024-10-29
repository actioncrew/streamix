import { Subject } from '../../lib';
import { Chunk, Emission, Operator, Stream, StreamOperator, Subscribable } from '../abstractions';

export class SwitchMapOperator extends Operator implements StreamOperator {

  private activeInnerStream!: Subscribable | null;
  private input!: Stream;
  private output!: Subject;
  private handleInnerEmission!: (({ emission, source }: any) => Promise<void>) | null;
  private isFinalizing!: boolean;

  constructor(private readonly project: (value: any) => Subscribable) {
    super();
    this.project = project;
  }

  override init(stream: Chunk) {
    this.activeInnerStream = null;
    this.input = stream;
    this.output = new Subject();
    this.handleInnerEmission = null;
    this.isFinalizing = false;

    this.input.onStop.once(async () => {
      if (this.activeInnerStream) {
        await this.activeInnerStream.awaitCompletion();
      }
      await this.finalize();
    });

    this.output.onStop.once(() => this.finalize());
  }

  get stream() {
    return this.output;
  }

  async finalize() {
    if (this.isFinalizing) { return; }
    this.isFinalizing = true;

    await this.stopInnerStream();
    if (this.output && !this.output.isStopped) {
      await this.output.complete();
    }
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {

    if (stream.shouldComplete()) {
      emission.isPhantom = true;
      await this.stopInnerStream();
      return emission;
    }

    try {
      return await this.processEmission(emission, this.output);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  private async processEmission(emission: Emission, stream: Subject): Promise<Emission> {
    const newInnerStream = this.project(emission.value);

    if (this.activeInnerStream === newInnerStream) {
      emission.isPhantom = true;
      return emission;
    }

    await this.stopInnerStream();
    this.activeInnerStream = newInnerStream;

    this.handleInnerEmission = async ({ emission }) => {
      if (!stream.shouldComplete()) {
        await stream.next(emission.value);
      }
    };

    this.activeInnerStream.onEmission.chain(this, this.handleInnerEmission);

    this.activeInnerStream.onError.once((error: any) => {
      emission.error = error;
      emission.isFailed = true;
      this.removeInnerStream(this.activeInnerStream!);
    });

    this.activeInnerStream.onStop.once(() => this.removeInnerStream(this.activeInnerStream!));

    this.activeInnerStream.subscribe();

    emission.isPhantom = true;
    return new Promise<Emission>((resolve) => {
      this.activeInnerStream!.onStop.once(() => resolve(emission));
    });

  }

  private removeInnerStream(innerStream: Subscribable) {
    if (this.activeInnerStream === innerStream) {
      this.activeInnerStream = null;
    }
  }

  private async stopInnerStream() {
    if (this.activeInnerStream) {
      this.activeInnerStream.onEmission.remove(this, this.handleInnerEmission!);
      this.activeInnerStream.complete();
      this.removeInnerStream(this.activeInnerStream);
    }
  }
}

export const switchMap = (project: (value: any) => Subscribable) => new SwitchMapOperator(project);
