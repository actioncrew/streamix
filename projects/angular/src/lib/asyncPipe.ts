import { Pipe, PipeTransform, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Stream } from '@actioncrew/streamix';

class StreamixAsyncPipe implements PipeTransform, OnDestroy {
  private _latestValue: any = null;
  private _streamixSubscription: any = null;
  private _promise: Promise<any> | null = null;

  constructor(private _ref: ChangeDetectorRef) {}

  transform(input: Promise<any> | Stream<any>): any {
    this._dispose(); // Clean up previous subscriptions

    if (input instanceof Stream) {
      // Handle Streamix Stream
      this._streamixSubscription = input.subscribe({
        next: (value) => {
          this._latestValue = value;
          this._ref.markForCheck(); // Trigger change detection
        },
        error: (err) => console.error(err),
        complete: () => console.log('Stream completed')
      });
    } else if (input instanceof Promise) {
      // Handle Promise
      this._promise = input;
      input.then(
        (value) => {
          this._latestValue = value;
          this._ref.markForCheck(); // Trigger change detection
        },
        (err) => console.error(err)
      );
    } else {
      throw new Error('Invalid input: Expected Promise or Stream');
    }

    return this._latestValue;
  }

  ngOnDestroy(): void {
    this._dispose();
  }

  private _dispose(): void {
    if (this._streamixSubscription) {
      this._streamixSubscription.unsubscribe();
      this._streamixSubscription = null;
    }
    this._promise = null;
    this._latestValue = null;
  }
}
