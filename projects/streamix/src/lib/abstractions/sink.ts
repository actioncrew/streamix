import { Emission } from './emission';
import { AbstractStream } from './stream';

export class StreamSink extends AbstractStream {
  source: AbstractStream;
  private sourceEmitter: AbstractStream;

  constructor(source: AbstractStream) {
    super();
    this.source = source;
    this.sourceEmitter = new Proxy(this.source, {
      get: (target, prop) => (prop === 'emit' ? this.emit.bind(this) : (target as any)[prop]),
    });
  }

  async run(): Promise<void> {
    await this.sourceEmitter.run();
  }

  override emit(emission: Emission): Promise<void> {
    return this.emitWithOperators(emission);
  }

  async emitWithOperators(emission: Emission): Promise<void> {
    try {
      let currentEmission = emission;
      let promise = this.head ? this.head.process(currentEmission, this) : Promise.resolve(currentEmission);

      currentEmission = await promise;

      if (currentEmission.isPhantom || currentEmission.isCancelled || currentEmission.isFailed) {
        return;
      }

      await Promise.all(this.subscribers.map(subscriber => subscriber(currentEmission.value)));
      currentEmission.isComplete = true;
    } catch (error: any) {
      console.error(`Error in stream ${this.constructor.name}: `, error);
      emission.isFailed = true;
      emission.error = error;
    }
  }
}
