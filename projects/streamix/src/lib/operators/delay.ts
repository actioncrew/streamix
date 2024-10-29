import { Chunk, Emission, Operator, Stream, Subscribable } from '../abstractions';

export class DelayOperator extends Operator {
  private applyDelay!: (emission: Emission) => Promise<Emission>;
  private completionPromise!: Promise<void>;

  constructor(private readonly delayTime: number) {
    super();
    this.delayTime = delayTime;
  }

  override init(stream: Chunk) {
    this.applyDelay = (emission: Emission) => new Promise<Emission>((resolve) => {
      const timeout = setTimeout(() => resolve(emission), this.delayTime);

      this.completionPromise = stream.awaitCompletion().then(() => {
        emission.isPhantom = true;
        clearTimeout(timeout);
        resolve(emission);
      });
    });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
    await this.applyDelay(emission)
    return emission;
  }
}

export const delay = (delayTime: number) => new DelayOperator(delayTime);
