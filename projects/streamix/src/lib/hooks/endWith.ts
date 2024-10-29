import { Chunk, Emission, HookOperator, Operator, Stream, Subscribable } from '../abstractions';

export class EndWithOperator extends Operator implements HookOperator {
  private boundStream!: Stream;
  private hasEmitted = false;

  constructor(private readonly value: any) {
    super();
  }

  override init(stream: Chunk) {
    this.boundStream = stream;
    this.boundStream.onComplete.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    return this.boundStream.emit({ emission: { value: this.value }, source: this });
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function endWith(value: any) {
  return new EndWithOperator(value);
}

