import { Emission, Stream, Subscribable } from '../abstractions';

export class CombineLatestStream<T = any> extends Stream<T[]> {
  private readonly sources: Subscribable[];
  private values: { hasValue: boolean; value: any }[];
  private handleEmissionFns: Array<(event: { emission: Emission, source: Subscribable }) => void> = [];

  constructor(sources: Subscribable[]) {
    super();
    this.sources = sources;
    this.values = sources.map(() => ({ hasValue: false, value: undefined }));

    this.sources.forEach((source, index) => {
      this.handleEmissionFns[index] = (event) => this.handleEmission(index, event.emission.value);
      source.onEmission.chain(this, this.handleEmissionFns[index]);
    });
  }

  override async run(): Promise<void> {
    this.sources.forEach((source) => source.start());

    try {
      await Promise.race([this.awaitTermination(),
        Promise.all(this.sources.map(source => source.awaitCompletion())),
        Promise.race(this.sources.map(source => source.awaitTermination()))
      ]);

    } catch (error) {
      await this.handleError(error);
    } finally {
      this.complete();
    }
  }

  private async handleEmission(index: number, value: any): Promise<void> {
    if (this.shouldComplete() || this.shouldTerminate()) {
      return;
    }

    this.values[index] = { hasValue: true, value };

    if (this.values.every(v => v.hasValue)) {
      await this.onEmission.process({
        emission: { value: this.values.map(({ value }) => value) },
        source: this,
      });
    }
  }

  override async complete(): Promise<void> {
    this.sources.forEach((source, index) => {
      source.onEmission.remove(this, this.handleEmissionFns[index]);
      source.complete();
    });
    return super.complete();
  }

  override async terminate(): Promise<void> {
    this.sources.forEach((source, index) => {
      source.onEmission.remove(this, this.handleEmissionFns[index]);
      source.terminate();
    });
    return super.terminate();
  }
}

export function combineLatest<T = any>(sources: Subscribable[]): CombineLatestStream<T> {
  return new CombineLatestStream<T>(sources);
}
