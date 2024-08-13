import { Stream, Subscribable } from '../abstractions';

export class MergeStream<T = any> extends Stream<T> {
  private sources: Subscribable[];

  constructor(...sources: Subscribable[]) {
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

export function merge<T = any>(...sources: Subscribable[]) {
  return new MergeStream<T>(...sources);
}

