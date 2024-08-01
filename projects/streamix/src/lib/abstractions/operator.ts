import { Emission } from './emission';
import { AbstractStream } from './stream';

export abstract class AbstractOperator {
  next?: AbstractOperator;

  abstract handle(emission: Emission, stream: AbstractStream): Promise<Emission>;

  async process(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled() === false) {
      try {
        emission = await this.handle(emission, stream);
      } catch (error) {
        emission.isFailed = true;
        emission.error = error;
      }
      if (this.next && !emission.isPhantom && !emission.isCancelled && !emission.isFailed) {
        return this.next.process(emission, stream);
      } else {
        return emission;
      }
    } else {
      emission.isCancelled = true;
      return emission;
    }
  }

  clone(): AbstractOperator {
    const clonedOperator = Object.create(Object.getPrototypeOf(this));
    Object.assign(clonedOperator, this);
    clonedOperator.next = undefined; // Do not copy the next reference to avoid recursive copy
    return clonedOperator;
  }
}
