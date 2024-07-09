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

  async run(): Promise<void> {
    while (this.currentSourceIndex < this.sources.length && !this.isCancelled) {
      await this.runCurrentSource();
      this.currentSourceIndex++;
    }

    if (this.currentSourceIndex >= this.sources.length) {
      this.isAutoComplete = true;
    }
  }

  private async runCurrentSource(): Promise<void> {
    const currentSource = this.sources[this.currentSourceIndex];

    this.currentSubscription = currentSource.subscribe((value: any) => {
      this.emit({ value });
    });

    await currentSource.isStopped.promise;
    this.currentSubscription.unsubscribe();
  }

  override cancel(): Promise<void> {
    return super.cancel();
  }
}

export function concat(...sources: AbstractStream[]) {
  return new ConcatStream(...sources);
}
