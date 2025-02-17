import { Stream } from '@actioncrew/streamix';
import { Directive, Input, OnDestroy, OnInit, TemplateRef, ViewContainerRef } from '@angular/core';

/**
 * A structural directive that binds to a stream and automatically updates the DOM with the latest emitted value.
 *
 * This directive listens to a stream and makes the emitted value available for use in the template. It works by subscribing to
 * the provided stream and updating the DOM with the latest emitted value. The value can be accessed directly within the template.
 *
 * Usage:
 * 1. Bind the stream property of the component to the `stream` input.
 * 2. The emitted value will be available as the `streamValue` context variable inside the template.
 *
 * Example:
 * ```html
 * <div *stream="let streamValue = stream">
 *   <span>{{ streamValue }}</span>
 * </div>
 * ```
 * In this example:
 * - `streamValue` is the variable that holds the latest emitted value from the stream.
 * - The `<span>` will automatically update whenever the stream emits a new value.
 */
@Directive({
  selector: '[stream]', // The selector to bind to the stream
  standalone: false
})
export class StreamDirective<T> implements OnInit, OnDestroy {
  @Input() stream!: Stream<T>; // Input to bind the stream
  private subscription: any;    // Store the subscription to the stream
  private _value: T | undefined; // Store the current value of the stream

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef
  ) {}

  ngOnInit() {
    if (this.stream) {
      this.subscription = this.stream.subscribe((value: T) => {
        this._value = value; // Get the emitted value
        this.updateDOM();    // Update the DOM with the new value
      });
    }
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe(); // Cleanup the subscription
    }
  }

  // Expose the current value to the template context
  get value(): T | undefined {
    return this._value;
  }

  // Update the DOM with the emitted value
  private updateDOM() {
    if (this._value !== undefined) {
      // Only update the view if it hasn't been created yet
      if (!this.viewContainer.length) {
        this.viewContainer.createEmbeddedView(this.templateRef, {
          $implicit: this._value // Pass the current stream value as the implicit context
        });
      } else {
        // If the view already exists, update it by creating a new view with the latest value
        this.viewContainer.clear(); // Clear the existing view
        this.viewContainer.createEmbeddedView(this.templateRef, {
          $implicit: this._value // Pass the updated value as the implicit context
        });
      }
    } else {
      // Clear the view when the value is undefined
      this.viewContainer.clear();
    }
  }
}
