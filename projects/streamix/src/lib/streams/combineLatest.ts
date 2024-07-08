import { Subscription } from '../abstractions';
import { AbstractStream } from '../abstractions/stream';

export class CombineLatestStream extends AbstractStream {
  private readonly sources: AbstractStream[] = [];
  private subscriptions: Subscription[] = [];
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
        this.subscriptions.push(source.subscribe((value: any) => {
          if(this.sources.some(source => source.isStopped.value || source.isCancelled || source.isAutoComplete)) {
            this.isStopped.resolve(true);
            resolve();
            return;
          }

          this.values[index].hasValue = true;
          this.values[index].value = value;

          if (this.remaining > 0) {
            this.remaining--;
          }

          if (this.remaining === 0) {
            this.emit({ value: [...this.values.map(({value}) => value)] });
          }
        }));
      });

      this.isUnsubscribed.promise.then(() => {
        if(!this.isStopRequested) {
          this.isStopRequested = true;
          return this.isStopped.promise.then(() => resolve());
        } else {
          return Promise.resolve();
        }
      });

      this.isStopped.promise.then(() => {
        this.subscriptions.forEach((subscription) => {
          subscription.unsubscribe();
        });

        this.isUnsubscribed.resolve(true);
      });
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
