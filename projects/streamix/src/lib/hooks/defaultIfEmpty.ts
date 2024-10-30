import { Chunk, Emission, HookOperator, Operator, Stream, Subscribable } from '../abstractions';

export class DefaultIfEmptyOperator extends Operator implements HookOperator {
  private chunk!: Chunk;
  private hasEmitted = false;

  constructor(private readonly defaultValue: any) {
    super();
  }

  override init(stream: Chunk) {
    this.chunk = stream;
    this.chunk.onComplete.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    if(!this.hasEmitted) {
      return this.chunk.stream.onEmission.parallel({ emission: { value: this.defaultValue }, source: this });
    }
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    // If the emission is not a phantom, cancelled, or failed, mark it as emitted
    if (!emission.isPhantom && !emission.isPhantom && !emission.isFailed) {
      this.hasEmitted = true;
    }

    return emission;
  }
}

export const defaultIfEmpty = (defaultValue: any) => new DefaultIfEmptyOperator(defaultValue);
