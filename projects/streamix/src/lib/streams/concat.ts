import { Stream, Subscribable } from '../abstractions';

export class ConcatStream<T = any> extends Stream<T> {
  private readonly sources: Subscribable[];

  private currentSourceIndex: number = 0;
  private handleEmissionFn: (event: { emission: { value: T }, source: Subscribable }) => void;

  constructor(...sources: Subscribable[]) {
    super();
    this.sources = sources;
    this.handleEmissionFn = ({ emission, source }) => this.handleEmission(emission.value);
  }

  async run(): Promise<void> {
    for (this.currentSourceIndex = 0; this.currentSourceIndex < this.sources.length; this.currentSourceIndex++) {
      if (this.shouldComplete()) {
        break;
      }
      await this.runCurrentSource();
    }

    if (!this.shouldComplete()) {
      this.isAutoComplete = true;
    }
  }

  private async runCurrentSource(): Promise<void> {
    const currentSource = this.sources[this.currentSourceIndex];
    try {
      currentSource.onEmission.chain(this, this.handleEmissionFn);
      currentSource.subscribe();
      await currentSource.awaitCompletion();
    }
    catch(error) {
      this.onError.parallel({ error });
    }
    finally{
      currentSource.onEmission.remove(this, this.handleEmissionFn);
      await currentSource.complete();
    }
  }

  private async handleEmission(value: T): Promise<void> {
    if (this.shouldComplete()) {
      return;
    }

    await this.onEmission.parallel({
      emission: { value },
      source: this,
    });
  }

  override async complete(): Promise<void> {
    for (const source of this.sources) {
      await source.complete();
    }
    return super.complete();
  }
}

export function concat<T = any>(...sources: Subscribable[]): ConcatStream<T> {
  return new ConcatStream<T>(...sources);
}
