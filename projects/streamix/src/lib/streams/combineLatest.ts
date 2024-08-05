import { Stream } from '../abstractions/stream';
import { Subscription } from '../abstractions/subscription';

export class CombineLatestStream<T = any> extends Stream<T[]> {
  private readonly sources: Stream<any>[];
  private subscriptions: Subscription[] = [];
  private values: { hasValue: boolean, value: any }[];
  private remaining: number;

  constructor(sources: Stream<any>[]) {
    super();
    this.sources = sources;
    this.values = sources.map(() => ({ hasValue: false, value: undefined }));
    this.remaining = sources.length;
  }

  override async run(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.sources.forEach((source, index) => {
        const subscription = source.subscribe((value: any) => {
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
        });

        this.subscriptions.push(subscription);
      });

      Promise.race([this.awaitCompletion(), this.awaitTermination()]).then(() => {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
        resolve();
      });
    });
  }

  override subscribe(callback: (value: T[]) => any): Subscription {
    const subscription = super.subscribe(callback);
    // Return a subscription object with an unsubscribe method
    return {
      unsubscribe: () => {
        subscription.unsubscribe();

        if (this.subscribers.length === 0) {
          // Ensure all source streams are stopped
          this.sources.forEach(source => {
            source.isStopRequested.resolve(true);
            source.isUnsubscribed.resolve(true);
          });

          // Unsubscribe from all sources
          this.subscriptions.forEach(subscription => subscription.unsubscribe());
        }
      }
    };
  }
}

export function combineLatest(sources: Stream<any>[]) {
  return new CombineLatestStream(sources);
}
