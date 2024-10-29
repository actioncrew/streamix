import { Chunk, Stream, Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class BufferCountOperator extends Operator {

  private buffer!: any[];

  constructor(private readonly bufferSize: number) {
    super();
    this.bufferSize = bufferSize;
  }

  override init(stream: Chunk) {
    this.buffer = [];
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {

    this.buffer.push(emission.value);

    if (this.buffer.length >= this.bufferSize) {
      const bufferedArray = this.buffer;
      this.buffer = [];
      return { value: bufferedArray };
    }

    // Return a phantom emission if buffer is not yet full
    return { isPhantom: true };
  }
}

export const bufferCount = (bufferSize: number) => new BufferCountOperator(bufferSize);
