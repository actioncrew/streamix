import { counter, Subject } from '../../lib';
import { Emission, Operator, Stream, StreamOperator, Subscribable, Subscription } from '../abstractions';

export class SwitchMapOperator<T, R> extends Operator implements StreamOperator {
  private activeInnerStream: Subscribable<R> | null = null;
  private isFinalizing = false;
  private emissionNumber = 0;
  private executionNumber = counter(0);
  private output = new Subject<R>();
  private subscription!: Subscription;

  constructor(private readonly project: (value: T) => Subscribable<R>) {
    super();
  }

  override init(stream: Stream<T>) {
    stream.onStop.once(async () => {
      await this.executionNumber.waitFor(this.emissionNumber);
      await this.finalize();
    });
    this.output.onStop.once(() => this.finalize());
  }

  get stream() {
    return this.output;
  }

  private async finalize() {
    if (this.isFinalizing) return;
    this.isFinalizing = true;

    await this.stopInnerStream();
    if (!this.output.isStopped) {
      await this.output.complete();
    }
  }

  private async stopInnerStream() {
    if (this.activeInnerStream) {
      this.subscription.unsubscribe();
      this.activeInnerStream = null;
    }
  }

  private handleInnerEmission = async (value: any) => {
    await this.output.next(value);
  };

  async handle(emission: Emission, stream: Subscribable<T>): Promise<Emission> {
    this.emissionNumber++;
    let subscribed = false;

    try {
      const newInnerStream = this.project(emission.value);

      // Ensure active inner stream is stopped before starting a new one
      if (this.activeInnerStream !== newInnerStream) {
        await this.stopInnerStream();
      }

      this.activeInnerStream = newInnerStream;

      this.activeInnerStream.onStop.once(() => {
        this.executionNumber.increment();
      });

      this.subscription = this.activeInnerStream.subscribe((value) => this.handleInnerEmission(value));
      subscribed = true;

      emission.phantom = true;
      return emission;
    } catch (error) {
      if (!subscribed) this.executionNumber.increment();
      emission.failed = true;
      emission.error = error;
      return emission;
    }
  }
}

// Helper function to create a SwitchMap operator
export const switchMap = <T, R>(project: (value: T) => Subscribable<R>) => {
  return new SwitchMapOperator<T, R>(project);
};
