import { finalize } from '@actioncrew/streamix';
import { Subject } from '../../lib';
import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class IifOperator extends Operator {
  private outerStream = new Subject();
  private currentStream: Subscribable | null = null;
  private finalizePromise: Promise<void> | null = null;
  private hasStartedTrueStream: boolean = false;
  private hasStartedFalseStream: boolean = false;

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: Subscribable,
    private readonly falseStream: Subscribable
  ) {
    super();
  }

  override init(stream: Subscribable) {
    this.initializeOuterStream();
    // Chain handlers for both streams during initialization
    this.trueStream.onEmission.chain(this, this.handleInnerEmission);
    this.falseStream.onEmission.chain(this, this.handleInnerEmission);

    this.finalizePromise = Promise.all([
      this.trueStream.awaitCompletion(),
      this.falseStream.awaitCompletion()
    ]).then(() => this.cleanup());
  }

  private initializeOuterStream() {
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  override async cleanup() {
    this.trueStream.onEmission.remove(this, this.handleInnerEmission);
    this.falseStream.onEmission.remove(this, this.handleInnerEmission);
    await Promise.all([this.trueStream.complete(), this.falseStream.complete()]);
    await this.outerStream.complete();
  }

  private async handleInnerEmission({ emission, source }: { emission: Emission, source: Subscribable }) {
    if (this.currentStream === source) {
      await this.outerStream.next(emission.value);
    }
  };

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    const selectedStream = this.condition(emission) ? this.trueStream : this.falseStream;

    if (this.currentStream !== selectedStream) {
      // Switch to the new stream
      this.currentStream = selectedStream;
    }

    if (!this.hasStartedTrueStream) {
      this.trueStream.start();
      this.hasStartedTrueStream = true;
    }

    if (!this.hasStartedFalseStream) {
      this.falseStream.start();
      this.hasStartedFalseStream = true;
    }

    emission.isPhantom = true;
    return emission; // Return the modified emission
  }
}

export const iif = (condition: (emission: Emission) => boolean, trueStream: Subscribable, falseStream: Subscribable) => new IifOperator(condition, trueStream, falseStream);
