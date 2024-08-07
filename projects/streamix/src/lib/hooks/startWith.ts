import { Emission, Hook, Subscribable } from '../abstractions';
import { Operator } from '../abstractions/operator';


export class StartWithOperator extends Operator implements Hook {

  constructor(private value: any) {
    super();
  }

  async callback({ stream, error }: any): Promise<void> {
    return stream.emit({ value: this.value }, stream.head!);
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function startWith(value: any) {
  return new StartWithOperator(value);
}

