import { Chunk, Emission, HookOperator, Stream, Subscribable } from '../abstractions';
import { Operator } from '../abstractions/operator';


export class StartWithOperator extends Operator implements HookOperator {
  private chunk!: Chunk;

  constructor(private readonly value: any) {
    super();
  }

  override init(stream: Chunk) {
    this.chunk = stream;
    this.chunk.onStart.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    return this.chunk.emit({ emission: { value: this.value }, source: this });
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function startWith(value: any) {
  return new StartWithOperator(value);
}

