import { Emission } from './emission';
import { AbstractStream } from './stream';

export abstract class AbstractOperator {
  next?: AbstractOperator;

  abstract handle(emission: Emission, stream: AbstractStream): Promise<Emission>;

  async process(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value === false) {
      try {
        emission = await this.handle(emission, stream);
      } catch (error) {
        emission.isFailed = true;
        emission.error = error;
      }
      if (this.next) {
        return this.next.process(emission, stream);
      } else {
        return emission;
      }
    } else {
      await this.cancelChain(stream.head!);
      emission.isCancelled = true;
      return emission;
    }
  }

  async cancel(): Promise<void> {
  }

  async cancelChain(operator: AbstractOperator) : Promise<void> {
    await operator.cancel();
    if (operator.next) {
      await this.cancelChain(operator.next);
    }
  }

  clone(): AbstractOperator {
    const clonedOperator = Object.create(Object.getPrototypeOf(this));
    Object.assign(clonedOperator, this);
    clonedOperator.next = undefined; // Do not copy the next reference to avoid recursive copy
    return clonedOperator;
  }
}
