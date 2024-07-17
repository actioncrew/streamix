import { AbstractStream } from '../abstractions/stream';
import { Subscription } from '../abstractions/subscription';

export class ConcatStream extends AbstractStream {
  private sources: AbstractStream[];
  private currentSourceIndex: number = 0;
  private currentSubscription?: Subscription;

  constructor(...sources: AbstractStream[]) {
    super();
    this.sources = sources;
  }

  override async run(): Promise<void> {
    try {
      for (this.currentSourceIndex = 0; this.currentSourceIndex < this.sources.length; this.currentSourceIndex++) {
        if (this.isCancelled.value || this.isUnsubscribed.value) { break; }
        await this.runCurrentSource();
      }
      this.isAutoComplete.resolve(true);
    } catch(error) {
      this.isFailed.resolve(error);
    }
  }

  private async runCurrentSource(): Promise<void> {
    const currentSource = this.sources[this.currentSourceIndex];

    return new Promise<void>((resolve, reject) => {
      this.currentSubscription = currentSource.subscribe(async (value: any) => {
        if (this.isCancelled.value) {
          this.currentSubscription?.unsubscribe();
          resolve();
          return;
        }

        try {
          await this.emit({ value });
        } catch (error) {
          reject(error);
        }
      });

      currentSource.isStopped.promise.then(() => {
        this.currentSubscription?.unsubscribe();
        resolve();
      }).catch((error) => {
        this.currentSubscription?.unsubscribe();
        reject(error);
      });
    });
  }

  override async cancel(): Promise<void> {
    this.currentSubscription?.unsubscribe();
    for (const source of this.sources) {
      await source.cancel();
    }
    return super.cancel();
  }
}

export function concat(...sources: AbstractStream[]) {
  return new ConcatStream(...sources);
}
