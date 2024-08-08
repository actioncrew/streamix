import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class BufferCountOperator extends Operator {
  private readonly bufferSize: number;
  private buffer: any[] = [];

  constructor(bufferSize: number) {
    super();
    this.bufferSize = bufferSize;
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    if (emission.isPhantom) {
      return emission;
    }

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
