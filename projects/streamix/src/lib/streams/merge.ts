import { Stream } from '../abstractions/stream';

export class MergeStream extends Stream {
  private sources: Stream[];

  constructor(...sources: Stream[]) {
    super();
    this.sources = sources;
  }

  override async run(): Promise<void> {
    const subscriptions = this.sources.map(source => source.subscribe((value: any) => {
      // Emit the merged value
      this.onEmission.process({ emission: { value }, source: this });
    }));

    return Promise.all(subscriptions).then(() => {
      this.isAutoComplete.resolve(true);
    });
  }
}

export function merge(...sources: Stream[]) {
  return new MergeStream(...sources);
}

