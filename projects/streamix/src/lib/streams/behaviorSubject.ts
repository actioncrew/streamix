import { Subscription } from "../abstractions";
import { Subject } from "./subject";

export class BehaviorSubject<T = any> extends Subject<T> {
  private latestValue: T;

  constructor(private readonly initialValue: T) {
    super();
    this.latestValue = initialValue;
    this.buffer.push(this.initialValue); // Buffer the initial value if not running yet
  }

  // Override the next method to update the latest value and emit it
  override async next(value: T): Promise<void> {
    // Store the latest value
    this.latestValue = value;

    // Emit the new value via the parent Subject's mechanism
    return super.next(value);
  }

  // Ensure latest value is emitted when a new subscriber subscribes
  override subscribe(callback?: ((value: T) => void) | void): Subscription {
    // Immediately emit the latest value to the new subscriber
    if (callback) {
      callback(this.latestValue);
    }

    // Proceed with normal subscription
    return super.subscribe(callback);
  }
}
