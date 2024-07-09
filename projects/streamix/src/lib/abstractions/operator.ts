import { Emission } from './emission';
import { AbstractStream } from './stream';

export abstract class AbstractOperator {
  abstract handle(request: Emission, stream: AbstractStream): Promise<Emission>;
  next?: AbstractOperator;
}
