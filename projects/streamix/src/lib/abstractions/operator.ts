import { Stream } from '../abstractions';
import { Emission } from './emission';
import { Subscribable } from './subscribable';


export interface HookOperator {
  callback: (params?: any) => void | Promise<void>;
}

export interface StreamOperator {
  get stream(): Subscribable;
}


export abstract class Operator {
  next?: Operator;

  init(stream: Stream) {
  }

  async cleanup(): Promise<void> {
  }

  abstract handle(emission: Emission, stream: Subscribable): Promise<Emission>;

  async process(emission: Emission, chunk: Stream): Promise<Emission> {
    try {
      emission = await this.handle(emission, chunk);
      if (this.next && !emission.isPhantom && !emission.isFailed) {
        return this.next.process(emission, chunk);
      } else {
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
