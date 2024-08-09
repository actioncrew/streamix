import { Emission } from './emission';
import { Subscribable } from './subscribable';

export abstract class Operator {
  next?: Operator;

  abstract handle(emission: Emission, stream: Subscribable): Promise<Emission>;

  async cleanup(): Promise<void> {
    throw new Error("Not implemented");
  }

  async process(emission: Emission, stream: Subscribable): Promise<Emission> {
    try {
      if (stream.isCancelled() === false) {
        emission = await this.handle(emission, stream);
        if (this.next && !emission.isPhantom && !emission.isCancelled && !emission.isFailed) {
          return this.next.process(emission, stream);
        } else {
          return emission;
        }
      } else {
        emission.isCancelled = true;
        return emission;
      }
    } catch (error) {
      emission.isFailed = true;
      emission.error = error;
      throw error;
    }
  }

  clone(): Operator {
    const clonedOperator = Object.create(Object.getPrototypeOf(this));
    Object.assign(clonedOperator, this);
    clonedOperator.next = undefined; // Do not copy the next reference to avoid recursive copy
    return clonedOperator;
  }
}
