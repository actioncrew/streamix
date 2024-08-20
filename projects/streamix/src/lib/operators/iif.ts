import { Subject } from '../../lib';
import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class IifOperator extends Operator {
  private outerStream = new Subject();

  constructor(
    private readonly condition: (emission: Emission) => boolean,
    private readonly trueStream: Subscribable,
    private readonly falseStream: Subscribable
  ) {
    super();
  }

  private initializeOuterStream() {
    this.outerStream.isCancelled.then(() => this.cleanup());
    this.outerStream.isFailed.then(() => this.cleanup());
    this.outerStream.isStopped.then(() => this.cleanup());
  }

  override init(stream: Subscribable) {
    this.initializeOuterStream();
  }

  override async cleanup() {
    await this.outerStream.complete();
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    // Check the condition for every emission
    const selectedStream = this.condition(emission) ? this.trueStream : this.falseStream;

    // Unsubscribe from any previous inner stream to avoid potential memory leaks
    let innerSubscription = selectedStream.subscribe(async (value) => {
      await this.outerStream.next(value);
    });

    // Cleanup when the selected stream completes or terminates
    Promise.race([selectedStream.awaitCompletion(), selectedStream.awaitTermination()]).then(() => {
      innerSubscription.unsubscribe();
      this.outerStream.complete();
    });

    emission.isPhantom = true;

    return new Promise<Emission>((resolve) => {
      selectedStream.isStopped.then(() => resolve(emission));
    });
  }
}

export const iif = (condition: (emission: Emission) => boolean, trueStream: Subscribable, falseStream: Subscribable) => new IifOperator(condition, trueStream, falseStream);
