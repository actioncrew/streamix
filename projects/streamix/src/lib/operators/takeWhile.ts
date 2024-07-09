import { AbstractStream } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';

export class TakeWhileOperator extends AbstractOperator {
  private readonly predicate: (value: any) => boolean;

  constructor(predicate: (value: any) => boolean) {
    super();
    this.predicate = predicate;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    const shouldContinue = this.predicate(request.value);
    if (!shouldContinue) {
      return Promise.resolve({ ...request, isFinished: true });
    }

    return this.next ? this.next.handle(request, stream) : Promise.resolve(request);
  }
}

export function takeWhile(predicate: (value: any) => boolean) {
  return new TakeWhileOperator(predicate);
}
