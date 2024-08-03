import { Subscription } from '../abstractions';
import { Stream } from '../abstractions/stream';

export class CombineLatestStream extends Stream {
  private readonly sources: Stream[] = [];
  private subscriptions: Subscription[] = [];
  private values: { hasValue: boolean, value: any }[];
  private remaining: number;

  constructor(sources: Stream[]) {
    super();
    this.sources = sources;
    this.values = sources.map(() => ({ hasValue: false, value: undefined }));
    this.remaining = sources.length;
  }

  override async run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sources.forEach((source, index) => {
        this.subscriptions.push(source.subscribe((value: any) => {
          if (this.sources.every(source => source.shouldComplete() || source.shouldTerminate())) {
            resolve();
            return;
          }

          if (!this.values[index].hasValue) {
            this.remaining--;
          }

          this.values[index].hasValue = true;
          this.values[index].value = value;

          if (this.remaining === 0) {
            this.emit({ value: this.values.map(({ value }) => value) }, this.head!);
          }
        }));
      });

      Promise.race([this.awaitCompletion(), this.awaitTermination()]).then(() => {
        this.subscriptions.forEach((subscription) => {
          subscription.unsubscribe();
        });
      });
    });
  }

  unsubscribe = () => {
    this.isStopRequested.resolve(true);
    this.isUnsubscribed.resolve(true);
    this.sources.forEach(source => { source.isStopRequested.resolve(true); source.isUnsubscribed.resolve(true); });
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  };
}

export function combineLatest(sources: Stream[]) {
  return new CombineLatestStream(sources);
}
