import { Stream, Subscribable } from '../abstractions';

export class MergeStream<T = any> extends Stream<T> {
  private sources: Subscribable[];
  private activeSources: number;
  private handleEmissionFns: Array<(event: { emission: { value: T }, source: Subscribable }) => void> = [];

  constructor(...sources: Subscribable[]) {
    super();
    this.sources = sources;
    this.activeSources = sources.length;

    this.sources.forEach((source, index) => {
      this.handleEmissionFns[index] = ({ emission }) => this.handleEmission(emission.value);
      source.onEmission.chain(this, this.handleEmissionFns[index]);
    });
  }

  override async run(): Promise<void> {
    try {
      this.sources.forEach(source => source.start(source));

      await Promise.race([
        Promise.all(this.sources.map(source =>
          Promise.race([source.awaitCompletion(), source.awaitTermination()])
        )),
        this.awaitCompletion(),
        this.awaitTermination()
      ]);

      if (!this.shouldComplete() && !this.shouldTerminate() && this.sources.every(source => source.shouldComplete())) {
        this.isAutoComplete.resolve(true);
      }
    } catch (error) {
      await this.handleError(error);
    } finally {
      await this.cleanup();
    }
  }

  private async handleEmission(value: T): Promise<void> {
    if (this.shouldComplete() || this.shouldTerminate()) {
      return;
    }

    await this.onEmission.process({
      emission: { value },
      source: this,
    });
  }

  private async cleanup(): Promise<void> {
    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      source.onEmission.remove(this, this.handleEmissionFns[i]);
      await source.complete();
    }
  }

  override async complete(): Promise<void> {
    await this.cleanup();
    return super.complete();
  }

  override async terminate(): Promise<void> {
    await this.cleanup();
    return super.terminate();
  }
}

export function merge<T = any>(...sources: Subscribable[]): MergeStream<T> {
  return new MergeStream<T>(...sources);
}
