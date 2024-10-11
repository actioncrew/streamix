import { Chunk, Stream } from '../abstractions';
import { Emission } from './emission';
import { Subscribable } from './subscribable';

export abstract class Operator {
  next?: Operator;

  init(stream: Stream): void {
  }

  abstract handle(emission: Emission, stream: Subscribable): Promise<Emission>;

  async cleanup(): Promise<void> {
    throw new Error("Not implemented");
  }

  async process(emission: Emission, chunk: Chunk): Promise<Emission> {
    try {
      let actualStream = chunk.stream;
      if (actualStream.isCancelled() === false) {
        emission = await this.handle(emission, actualStream);
        if (this.next && !emission.isPhantom && !emission.isCancelled && !emission.isFailed) {
          return this.next.process(emission, chunk);
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
