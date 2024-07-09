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

  run(): Promise<void> {
    if (this.currentSourceIndex >= this.sources.length) {
      this.isAutoComplete = true;
      return Promise.resolve();
    }

    const currentSource = this.sources[this.currentSourceIndex];

    // If there's an ongoing subscription, unsubscribe to ensure we move to the next source
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
      this.currentSubscription = undefined;
    }

    return new Promise<void>((resolve) => {
      this.currentSubscription = currentSource.subscribe((value: any) => {
        this.emit({ value });
      });

      currentSource.isStopped.promise.then(() => {
        resolve();
        this.currentSourceIndex++;
        this.run(); // Continue emitting from the next source
      });
    });
  }

  override unsubscribe(): void {
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
    }
  }
}

export function concat(...sources: AbstractStream[]) {
  return new ConcatStream(...sources);
}
