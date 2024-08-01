import { Emission } from './emission';
import { Stream } from './stream';

export abstract class Operator {
  next?: Operator;

  abstract handle(emission: Emission, stream: Stream): Promise<Emission>;

  async process(emission: Emission, stream: Stream): Promise<Emission> {
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

  clone(): Operator {
    const clonedOperator = Object.create(Object.getPrototypeOf(this));
    Object.assign(clonedOperator, this);
    clonedOperator.next = undefined; // Do not copy the next reference to avoid recursive copy
    return clonedOperator;
  }
}
