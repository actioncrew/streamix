import { Emission, Operator, Subscribable } from '../abstractions';
import { Hook } from '../abstractions/hook';


export class FinalizeOperator extends Operator implements Hook {
  private boundStream!: Subscribable;

  constructor(private callbackMethod: () => (void | Promise<void>)) {
    super();
  }

  init(stream: Subscribable) {
    this.boundStream = stream;
    this.boundStream.onStop.chain(this.callback.bind(this));
  }

  async callback(params?: any): Promise<void> {
    return this.callbackMethod();
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function finalize(callback: () => (void | Promise<void>)) {
  return new FinalizeOperator(callback);
}

