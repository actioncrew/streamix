import { Emission, HookOperator, Operator, Stream, Subscribable } from '../abstractions';

export class CatchErrorOperator extends Operator implements HookOperator {
  private boundStream!: Stream;

  constructor(private handler: (error?: any) => void | Promise<void>) {
    super();
  }

  override init(stream: Stream) {
    this.boundStream = stream;
    this.boundStream.onError.chain(this, this.callback);
  }

  async callback({ error }: any): Promise<void> {
    return this.handler(error);
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function catchError(handler: (error?: any) => void | Promise<void>) {
  return new CatchErrorOperator(handler);
}

