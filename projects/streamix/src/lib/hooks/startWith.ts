import { AbstractStream, Emission, Hook } from '../abstractions';
import { AbstractOperator } from '../abstractions/operator';


export class StartWithOperator extends AbstractOperator implements Hook {

  private hasEmitted = false;

  constructor(private value: any) {
    super();
  }

  async callback({ stream, error }: any): Promise<void> {
    if(!this.hasEmitted) {
      return stream.emit({ value: this.value }, stream.head!);
    }
  }

  override async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    return emission;
  }
}

export function startWith(value: any) {
  return new StartWithOperator(value);
}

