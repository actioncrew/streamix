import { Stream, Subscription } from '@actioncrew/streamix'; // Import the custom Stream type
import { Pipe, PipeTransform } from '@angular/core';

/**
 * A custom Angular pipe that listens to a Stream and transforms its emitted values into the latest value for the template.
 *
 * This pipe subscribes to the provided stream and updates the returned value every time a new emission occurs.
 * It returns the latest emitted value, allowing for easy binding of streams in templates.
 *
 * The pipe is **not pure** (i.e., it updates the view every time the stream emits a value).
 *
 * ### Usage Example:
 * ```html
 * <div>{{ myStream | stream }}</div>
 * ```
 * In this example:
 * - `myStream` is a stream that emits values.
 * - The `stream` pipe will automatically display the latest value of the stream in the `div` element.
 * - The value will update in the view whenever the stream emits new values.
 */
@Pipe({
  name: 'stream',  // Name the pipe
  pure: false,       // Allow it to update every time the stream changes
  standalone: false
})
export class StreamPipe implements PipeTransform {
  private subscription: Subscription | null = null;  // Store the subscription
  private value: any; // Store the latest value from the stream

  /**
   * Transforms the stream by subscribing to it and returning the latest value.
   *
   * @param stream The stream to subscribe to.
   * @returns The latest emitted value from the stream.
   */
  transform(stream: Stream<any> | null): any {
    if (!stream) {
      return null; // Return null if the stream is not provided
    }

    if (this.subscription) {
      this.subscription.unsubscribe(); // Unsubscribe from the previous stream
    }

    // Subscribe to the new stream
    this.subscription = stream.subscribe((value: any) => {
      this.value = value;  // Update the value when a new emission occurs
    });

    return this.value;  // Return the latest value
  }

  /**
   * Cleans up the subscription when the pipe is destroyed or the component is destroyed.
   */
  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe(); // Unsubscribe to avoid memory leaks
    }
  }
}
