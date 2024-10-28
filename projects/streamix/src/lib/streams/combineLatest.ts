import { Stream, Subscribable } from '../abstractions';

export class CombineLatestStream<T = any> extends Stream<T[]> {
  private values: { hasValue: boolean; value: any }[];
  private handleEmissionFns: Array<(event: { emission: { value: any }, source: Subscribable }) => void> = [];

  constructor(private readonly sources: Subscribable[]) {
    super();
    this.values = sources.map(() => ({ hasValue: false, value: undefined }));

    this.sources.forEach((source, index) => {
      this.handleEmissionFns[index] = (event) => this.handleEmission(index, event.emission.value);
      source.onEmission.chain(this, this.handleEmissionFns[index]);
    });
  }

  async run(): Promise<void> {
    this.sources.forEach((source) => source.subscribe());

    try {
      await Promise.race([this.awaitCompletion(),
        Promise.all(this.sources.map(source => source.awaitCompletion()))
      ]);

    } catch (error) {
      await this.onError.parallel({ error });
    } finally {
      this.complete();
    }
  }

  private async handleEmission(index: number, value: any): Promise<void> {
    if (this.shouldComplete()) {
      return;
    }

    this.values[index] = { hasValue: true, value };

    if (this.values.every(v => v.hasValue)) {
      await this.onEmission.parallel({
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
}

export function combineLatest<T = any>(sources: Subscribable[]): CombineLatestStream<T> {
  return new CombineLatestStream<T>(sources);
}
