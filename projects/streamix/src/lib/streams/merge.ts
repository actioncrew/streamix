import { Stream, Subscribable } from '../abstractions';

export class MergeStream<T = any> extends Stream<T> {
  private readonly sources: Subscribable[];
  private handleEmissionFns: Array<(event: { emission: { value: T }, source: Subscribable }) => void> = [];

  constructor(...sources: Subscribable[]) {
    super();
    this.sources = sources;

    this.sources.forEach((source, index) => {
      this.handleEmissionFns[index] = ({ emission }) => this.handleEmission(emission.value);
      source.onEmission.chain(this, this.handleEmissionFns[index]);
    });
  }

  async run(): Promise<void> {
    try {
      this.sources.forEach(source => source.start());

      await Promise.race([
        Promise.all(this.sources.map(source => source.awaitCompletion())),
        this.awaitCompletion()
      ]);

      if (!this.shouldComplete() && this.sources.every(source => source.shouldComplete())) {
        this.isAutoComplete = true;
      }
    } catch (error) {
      await this.propagateError(error);
    } finally {
      await this.cleanup();
    }
  }

  private async handleEmission(value: T): Promise<void> {
    if (this.shouldComplete()) {
      return;
    }

    await this.onEmission.process({
      emission: { value },
      source: this,
    });
  }

  private async finalize(): Promise<void> {
    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      source.onEmission.remove(this, this.handleEmissionFns[i]);
      await source.complete();
    }
  }

  override async complete(): Promise<void> {
    await this.finalize();
    return super.complete();
  }
}

export function merge<T = any>(...sources: Subscribable[]): MergeStream<T> {
  return new MergeStream<T>(...sources);
}
