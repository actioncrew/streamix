import { Subject } from '../../lib';
import { Chunk, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator, StreamOperator } from '../abstractions/operator';

export class IifOperator extends Operator implements StreamOperator {

  private outerStream!: Subject;
  private currentStream!: Subscribable | null;
  private finalizePromise!: Promise<void> | null;

  private hasStartedTrueStream!: boolean;
  private hasStartedFalseStream!: boolean;

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: Subscribable,
    private readonly falseStream: Subscribable
  ) {
    super();
  }

  get stream() {
    return this.outerStream;
  }

  override init(stream: Chunk) {
    this.outerStream = new Subject();
    this.currentStream = null;

    this.hasStartedTrueStream = false;
    this.hasStartedFalseStream = false;

    this.trueStream.onEmission.chain(this, this.handleInnerEmission);
    this.falseStream.onEmission.chain(this, this.handleInnerEmission);

    this.finalizePromise = Promise.all([
      this.trueStream.awaitCompletion(),
      this.falseStream.awaitCompletion()
    ]).then(() => this.finalize());
  }

  async finalize() {
    this.trueStream.onEmission.remove(this, this.handleInnerEmission);
    this.falseStream.onEmission.remove(this, this.handleInnerEmission);
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
      this.trueStream.subscribe();
      this.hasStartedTrueStream = true;
    }

    if (!this.hasStartedFalseStream) {
      this.falseStream.subscribe();
      this.hasStartedFalseStream = true;
    }

    emission.isPhantom = true;
    return emission; // Return the modified emission
  }
}

export const iif = (condition: (emission: Emission) => boolean, trueStream: Subscribable, falseStream: Subscribable) => new IifOperator(condition, trueStream, falseStream);
