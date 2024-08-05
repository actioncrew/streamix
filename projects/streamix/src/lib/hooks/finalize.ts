import { Emission, Operator, Subscribable } from '../abstractions';
import { Hook } from '../abstractions/hook';


export class FinalizeOperator extends Operator implements Hook {

  constructor(private callbackMethod: () => (void | Promise<void>)) {
    super();
  }

  async callback({ stream, error }: any): Promise<void> {
    return this.callbackMethod();
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function finalize(callback: () => (void | Promise<void>)) {
  return new FinalizeOperator(callback);
}

