import { Emission, Hook, Subscribable } from '../abstractions';
import { Operator } from '../abstractions/operator';


export class StartWithOperator extends Operator implements Hook {
  private boundStream!: Subscribable;

  constructor(private value: any) {
    super();
  }

  init(stream: Subscribable) {
    this.boundStream = stream;
    this.boundStream.onStart.chain(this.callback.bind(this));
  }

  async callback(params?: any): Promise<void> {
    return this.boundStream.onEmission.process({ emission: { value: this.value }, next: this.boundStream.head!});
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function startWith(value: any) {
  return new StartWithOperator(value);
}

