import { AbstractStream } from '../abstractions/stream';

export class MergeStream extends AbstractStream {
  private sources: AbstractStream[];

  constructor(...sources: AbstractStream[]) {
    super();
    this.sources = sources;
  }

  override async run(): Promise<void> {
    const subscriptions = this.sources.map(source => source.subscribe((value: any) => {
      // Emit the merged value
      this.emit({ value }, this.head!);
    }));

    return Promise.all(subscriptions).then(() => {
      this.isAutoComplete.resolve(true);
    });
  }
}

export function merge(...sources: AbstractStream[]) {
  return new MergeStream(...sources);
}

