import { Chunk, Emission, HookOperator, Stream, Subscribable } from '../abstractions';
import { Operator } from '../abstractions/operator';


export class StartWithOperator extends Operator implements HookOperator {
  private boundStream!: Stream;

  constructor(private readonly value: any) {
    super();
  }

  override init(stream: Chunk) {
    this.boundStream = stream;
    this.boundStream.onStart.chain(this, this.callback);
  }

  async callback(params?: any): Promise<void> {
    return this.boundStream.emit({ emission: { value: this.value }, source: this });
  }

  override async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    return emission;
  }
}

export function startWith(value: any) {
  return new StartWithOperator(value);
}

