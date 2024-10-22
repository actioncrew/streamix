import { Subscription } from "../abstractions";
import { Subject } from "./subject";

export class BehaviorSubject<T = any> extends Subject<T> {
  private latestValue: T;
  private hasEmittedInitialValue = false; // Track if the initial value has already been emitted

  constructor(private readonly initialValue: T) {
    super();
    this.latestValue = initialValue;

    // No need to emit the initial value in the constructor,
    // we'll emit it when someone subscribes
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
    if (callback) {
      // Emit the latest value only once per subscription
      if (!this.hasEmittedInitialValue) {
        callback(this.latestValue);
        this.hasEmittedInitialValue = true;
      }
    }

    // Proceed with normal subscription
    return super.subscribe(callback);
  }
}
