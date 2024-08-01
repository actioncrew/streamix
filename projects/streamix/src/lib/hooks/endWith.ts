import { Emission, Operator, Stream } from '../abstractions';
import { Hook } from '../abstractions/hook';


export class EndWithOperator extends Operator implements Hook {

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

export function endWith(value: any) {
  return new EndWithOperator(value);
}

