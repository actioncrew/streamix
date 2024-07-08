import { Emission } from './emission';

export abstract class AbstractOperator {
  abstract handle(request: Emission, cancellationToken?: boolean): Promise<Emission>;
  next?: AbstractOperator;
}
