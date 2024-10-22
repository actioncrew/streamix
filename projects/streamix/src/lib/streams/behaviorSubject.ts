import { Subscription } from "../abstractions";
import { Subject } from "./subject";

export class BehaviorSubject<T = any> extends Subject<T> {
  private latestValue: T;

  constructor(private readonly initialValue: T) {
    super();
    this.latestValue = initialValue;

    // Emit the initial value when the stream starts running
    queueMicrotask(() => {
      this.emissionAvailable = this.isRunning.then(() => {
        return this.onEmission.process({ emission: { value: this.initialValue }, source: this });
      });
    });
  }

  // Override the next method to update the latest value and emit it
  override async next(value: T): Promise<void> {
    // Store the latest value
    this.latestValue = value;

    // Call the parent Subject's next method to handle the emission
    return super.next(value);
  }

  // Ensure latest value is emitted when a new subscriber subscribes
  override subscribe(callback?: ((value: T) => void) | void): Subscription {
    // Emit the latest value immediately to the new subscriber
    if (this.isRunning()) {
      if (callback) {
        callback(this.latestValue);
      }
    }

    // Proceed with normal subscription
    return super.subscribe(callback);
  }
}
