import { Chunk, Emission, HookOperator, Operator, Stream, Subscribable } from '../abstractions';

export class EndWithOperator extends Operator implements HookOperator {
  private chunk!: Chunk;
  private hasEmitted = false;

  constructor(private readonly value: any) {
    super();
  }

  override init(stream: Chunk) {
    this.chunk = stream;
    this.chunk.onComplete.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    return this.chunk.stream.onEmission.parallel({ emission: { value: this.value }, source: this });
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function endWith(value: any) {
  return new EndWithOperator(value);
}

