import { Emission, Hook, Operator, Subscribable } from '../abstractions';

export class DefaultIfEmptyOperator extends Operator implements Hook {
  private boundStream!: Subscribable;
  private hasEmitted = false;

  constructor(private defaultValue: any) {
    super();
  }

  init(stream: Subscribable) {
    this.boundStream = stream;
    this.boundStream.onComplete.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    if(!this.hasEmitted) {
      return this.boundStream.onEmission.process({ emission: { value: this.defaultValue }, source: this });
    }
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    // If the emission is not a phantom, cancelled, or failed, mark it as emitted
    if (!emission.isPhantom && !emission.isCancelled && !emission.isFailed) {
      this.hasEmitted = true;
    }

    return emission;
  }
}

export const defaultIfEmpty = (defaultValue: any) => new DefaultIfEmptyOperator(defaultValue);
