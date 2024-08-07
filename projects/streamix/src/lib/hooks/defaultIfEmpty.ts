import { Emission, Hook, Operator, Subscribable } from '../abstractions';

export class DefaultIfEmptyOperator extends Operator implements Hook {
  private hasEmitted = false;

  constructor(private defaultValue: any) {
    super();
  }

  async callback({ stream, error }: any): Promise<void> {
    if(!this.hasEmitted) {
      return stream.emit({ value: this.defaultValue }, stream.head!);
    }
  }
  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    // If the emission is not a phantom, cancelled, or failed, mark it as emitted
    if (!emission.isPhantom && !emission.isCancelled && !emission.isFailed) {
      this.hasEmitted = true;
    }

    return emission;
  }

  override async process(emission: Emission, stream: Subscribable): Promise<Emission> {
    emission = await this.handle(emission, stream);

    // If this is the last emission and no values have been emitted, emit the default value
    if (emission.isComplete && !this.hasEmitted) {
      const defaultEmission = { value: this.defaultValue };
      await this.handle(defaultEmission, stream);
      return defaultEmission;
    }

    if (this.next && !emission.isPhantom && !emission.isCancelled && !emission.isFailed) {
      return this.next.process(emission, stream);
    } else {
      return emission;
    }
  }
}

export const defaultIfEmpty = (defaultValue: any) => new DefaultIfEmptyOperator(defaultValue);
