import { Emission, HookOperator, Operator, Stream, Subscribable } from '../abstractions';

export class FinalizeOperator extends Operator implements HookOperator {
  private boundStream!: Stream;

  constructor(private readonly callbackMethod: () => (void | Promise<void>)) {
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

