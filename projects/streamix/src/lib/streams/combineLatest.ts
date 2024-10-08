import { Stream, Subscribable, Subscription } from '../abstractions';

export class CombineLatestStream<T = any> extends Stream<T[]> {
  private readonly sources: Subscribable[];
  private values: { hasValue: boolean; value: any }[];
  private remaining: number;
  private handleEmissionFns: Array<(value: any) => void> = [];

  constructor(sources: Subscribable[]) {
    super();
    this.sources = sources;
    this.values = sources.map(() => ({ hasValue: false, value: undefined }));
    this.remaining = sources.length;

    // Store the complete callback as instance properties for each source
    this.sources.forEach((source, index) => {
      this.handleEmissionFns[index] = ({ emission, source }) => this.handleEmission(index, emission.value);
      source.onEmission.chain(this, this.handleEmissionFns[index]);
    });
  }

  override async run(): Promise<void> {
    this.sources.forEach((source, index) => {
      source.start(source);
    });

    return Promise.race([this.awaitCompletion(), this.awaitTermination()]).then(() => {
      this.clearAllChains();
    });
  }

  private async handleEmission(index: number, value: any): Promise<void> {
    if (this.sources.every((source) => source.shouldComplete() || source.shouldTerminate())) {
      return;
    }

    if (!this.values[index].hasValue) {
      this.remaining--;
    }

    this.values[index].hasValue = true;
    this.values[index].value = value;

    if (this.remaining === 0) {
      await this.onEmission.process({
        emission: { value: this.values.map(({ value }) => value) },
        source: this,
      });
    }
  }

  private clearAllChains(): void {
    this.sources.forEach((source, index) => {
      source.terminate();
    });
  }
}

export function combineLatest<T = any>(sources: Subscribable[]) {
  return new CombineLatestStream<T>(sources);
}
