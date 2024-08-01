import { Emission, Hook, Stream } from '../abstractions';
import { Operator } from '../abstractions/operator';


export class StartWithOperator extends Operator implements Hook {

  private hasEmitted = false;

  constructor(private value: any) {
    super();
  }

  async callback({ stream, error }: any): Promise<void> {
    if(!this.hasEmitted) {
      return stream.emit({ value: this.value }, stream.head!);
    }
  }

  override async handle(emission: Emission, stream: Stream): Promise<Emission> {
    return emission;
  }
}

export function startWith(value: any) {
  return new StartWithOperator(value);
}

