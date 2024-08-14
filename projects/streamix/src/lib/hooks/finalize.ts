import { Emission, Operator, Stream, Subscribable } from '../abstractions';
import { Hook } from '../abstractions/hook';


export class FinalizeOperator extends Operator implements Hook {
  private boundStream!: Stream;

  constructor(private callbackMethod: () => (void | Promise<void>)) {
    super();
  }

  override init(stream: Stream) {
    this.boundStream = stream;
    this.boundStream.onStop.chain(this, this.callback);
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

