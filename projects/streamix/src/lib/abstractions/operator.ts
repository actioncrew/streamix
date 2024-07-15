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
}
