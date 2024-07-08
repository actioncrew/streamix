import { AbstractStream } from '../abstractions/stream';

export class CombineLatestStream extends AbstractStream {
  private readonly sources: AbstractStream[];
  private values: any[];
  private remaining: number;

  constructor(...sources: AbstractStream[]) {
    super();
    this.sources = sources;
    this.values = new Array(sources.length).fill({hasValue: false, value: undefined});
    this.remaining = sources.length;
  }

  run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sources.forEach((source, index) => {
        source.subscribe((value: any) => {
          this.values[index].hasValue = true;
          this.values[index].value = value;

          if (this.remaining > 0) {
            this.remaining--;
          }

          if (this.remaining === 0) {
            this.emit({ value: [...this.values.map(({value}) => value)] });
          }
        });
      });

      if(this.sources.some(source => source.isStopped.value || source.isCancelled || source.isAutoComplete || source.isUnsubscribed.value)) {
        this.isStopped.resolve(true);
        resolve();
      }
    });
  }

  protected override unsubscribe = () => {
    this.isUnsubscribed.resolve(true);
    this.sources.forEach(source => source.isUnsubscribed.resolve(true));
  };
}

export function combineLatest(...sources: AbstractStream[]) {
  return new CombineLatestStream(...sources);
}
