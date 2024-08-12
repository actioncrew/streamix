import { Emission, Operator, Subscribable } from '../abstractions';
import { Hook } from '../abstractions/hook';


export class EndWithOperator extends Operator implements Hook {
  private boundStream!: Subscribable;
  private hasEmitted = false;

  constructor(private value: any) {
    super();
  }

  init(stream: Subscribable) {
    this.boundStream = stream;
    this.boundStream.onComplete.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    return this.boundStream.onEmission.process({ emission: { value: this.value }, source: this.boundStream });
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function endWith(value: any) {
  return new EndWithOperator(value);
}

