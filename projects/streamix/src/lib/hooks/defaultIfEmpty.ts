import { Emission, HookOperator, Operator, Stream, Subscribable } from '../abstractions';

export class DefaultIfEmptyOperator extends Operator implements HookOperator {
  private boundStream!: Stream;
  private hasEmitted = false;

  constructor(private readonly defaultValue: any) {
    super();
  }

  override init(stream: Stream) {
    this.boundStream = stream;
    this.boundStream.onComplete.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    if(!this.hasEmitted) {
      return this.boundStream.onEmission.parallel({ emission: { value: this.defaultValue }, source: this });
    }
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    // If the emission is not a phantom, cancelled, or failed, mark it as emitted
    if (!emission.phantom && !emission.phantom && !emission.failed) {
      this.hasEmitted = true;
    }

    return emission;
  }
}

export const defaultIfEmpty = (defaultValue: any) => new DefaultIfEmptyOperator(defaultValue);
