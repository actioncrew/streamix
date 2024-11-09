import { Subject } from '../../lib';
import { Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator, StreamOperator } from '../abstractions/operator';

export class IifOperator extends Operator implements StreamOperator {

  private outerStream!: Subject;
  private selectedStream: Subscribable | null = null;
  private hasSubscribed: boolean = false;

  constructor(
    private readonly condition: () => boolean,
    private readonly trueStream: Subscribable,
    private readonly falseStream: Subscribable
  ) {
    super();
  }

  get stream() {
    return this.outerStream;
  }

  override init(stream: Stream) {
    this.outerStream = new Subject();

    // Select the stream based on the condition (only once at the beginning)
    this.selectedStream = this.condition() ? this.trueStream : this.falseStream;

    // Subscribe to the selected stream and forward emissions
    this.selectedStream.onEmission.chain(this, this.handleInnerEmission);
    this.selectedStream.onStop.once(() => this.finalize());
  }

  private async finalize() {
    // Clean up emission chains
    this.selectedStream?.onEmission.remove(this, this.handleInnerEmission);
  }

  private async handleInnerEmission({ emission }: { emission: Emission }) {
    // Forward emissions from the selected stream
    await this.outerStream.next(emission.value);
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (!this.hasSubscribed) {
      this.selectedStream?.subscribe();
      this.hasSubscribed = true;
    }

    // No need to modify the emission as it's only needed for initial condition check
    return emission;
  }
}

// Factory function to create the IifOperator
export const iif = (
  condition: () => boolean,
  trueStream: Subscribable,
  falseStream: Subscribable
) => new IifOperator(condition, trueStream, falseStream);
