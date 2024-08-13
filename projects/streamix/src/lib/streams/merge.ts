import { Stream, Subscribable, Subscription } from '../abstractions';

export class MergeStream<T = any> extends Stream<T> {
  private sources: Subscribable[];
  private subscriptions: Array<{ unsubscribe: () => void }> = [];

  constructor(...sources: Subscribable[]) {
    super();
    this.sources = sources;
  }

  override async run(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let activeSources = this.sources.length;

      this.sources.forEach(source => {
        const subscription = source.subscribe((value: any) => {
          this.onEmission.process({ emission: { value }, source: this });
        });

        source.isStopped.then(() => {
          activeSources--;
          if (activeSources === 0) {
            this.isAutoComplete.resolve(true);
            resolve();
          }
        });

        source.isFailed.then((err: any) => {
          this.isAutoComplete.reject(err);
          reject(err);
        });

        this.subscriptions.push(subscription);
      });
    });
  }

  override subscribe(callback: void | ((value: T) => any)): Subscription {
    let subscription = super.subscribe(callback);

    // Return a subscription object with an unsubscribe method
    return {
      unsubscribe: () => {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
        this.subscriptions = [];
        subscription.unsubscribe();
      }
    };
  }
}

export function merge<T = any>(...sources: Subscribable[]) {
  return new MergeStream<T>(...sources);
}

