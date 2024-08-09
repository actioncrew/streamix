import { Emission, Operator, Stream, Subscribable } from '../abstractions';
import { Hook } from '../abstractions/hook';


export class EndWithOperator extends Operator implements Hook {
  private boundStream!: Stream;
  private hasEmitted = false;

  constructor(private value: any) {
    super();
  }

  init(stream: Stream) {
    this.boundStream = stream;
    this.boundStream.onComplete.chain(this.callback.bind(this));
  }

  async callback(params?: any): Promise<void> {
    return this.boundStream.onEmission.process({ emission: { value: this.value }, next: this.boundStream.head! });
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function endWith(value: any) {
  return new EndWithOperator(value);
}

