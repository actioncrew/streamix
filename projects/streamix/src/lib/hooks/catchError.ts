import { Emission, Operator, Subscribable } from '../abstractions';
import { Hook } from '../abstractions/hook';


export class CatchErrorOperator extends Operator implements Hook {
  private boundStream!: Subscribable;

  constructor(private handler: (error?: any) => void | Promise<void>) {
    super();
  }

  init(stream: Subscribable) {
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

