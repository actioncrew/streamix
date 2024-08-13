import { Stream, Subscribable } from '../abstractions';
import { Subscription } from '../abstractions/subscription';

export class ConcatStream<T = any> extends Stream<T> {
  private sources: Subscribable[];
  private currentSourceIndex: number = 0;
  private currentSubscription?: Subscription;

  constructor(...sources: Subscribable[]) {
    super();
    this.sources = sources;
  }

  override async run(): Promise<void> {

    for (this.currentSourceIndex = 0; this.currentSourceIndex < this.sources.length && !this.shouldComplete(); this.currentSourceIndex++) {
      if (this.isCancelled() || this.isUnsubscribed()) { break; }
      await this.runCurrentSource();
    }

    if(!this.shouldComplete()) {
      this.isAutoComplete.resolve(true);
    }
  }

  private async runCurrentSource(): Promise<void> {
    const currentSource = this.sources[this.currentSourceIndex];

    return new Promise<void>((resolve, reject) => {
      this.currentSubscription = currentSource.subscribe(async (value: any) => {
        if (this.isCancelled()) {
          this.currentSubscription?.unsubscribe();
          resolve();
          return;
        }

        try {
          await this.onEmission.process({ emission: { value }, source: this });
        } catch (error) {
          reject(error);
        }
      });

      currentSource.isStopped.then(() => {
        this.currentSubscription?.unsubscribe();
        resolve();
      }).catch((error) => {
        this.currentSubscription?.unsubscribe();
        reject(error);
      });
    });
  }

  override async terminate(): Promise<void> {
    this.currentSubscription?.unsubscribe();
    for (const source of this.sources) {
      await source.terminate();
    }
    return super.terminate();
  }
}

export function concat<T = any>(...sources: Subscribable[]) {
  return new ConcatStream<T>(...sources);
}
