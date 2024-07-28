import { Emission } from './emission';
import { AbstractStream } from './stream';

export abstract class AbstractOperator {
  next?: AbstractOperator;

  abstract handle(emission: Emission, stream: AbstractStream): Promise<Emission>;

  async process(emission: Emission, stream: AbstractStream): Promise<Emission> {

    const request = await this.handle(emission, stream);
    if (this.next) {
      return this.next.process(request, stream);
    } else {
      return request;
    }
  }

  cancel(): void {
  }
  
  clone(): AbstractOperator {
    const clonedOperator = Object.create(Object.getPrototypeOf(this));
    Object.assign(clonedOperator, this);
    clonedOperator.next = undefined; // Do not copy the next reference to avoid recursive copy
    return clonedOperator;
  }
}
