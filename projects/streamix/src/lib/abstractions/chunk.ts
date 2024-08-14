import { Stream } from '../abstractions';
import { hook } from '../utils';
import { Emission } from './emission';
import { Operator } from './operator';
import { Subscribable } from './subscribable';
import { Subscription } from './subscription';

export class Chunk<T = any> extends Stream<T> implements Subscribable<T> {
  operators: Operator[] = [];
  head: Operator | undefined;
  tail: Operator | undefined;

  constructor(public stream: Stream<T>) {
    super();
    Object.assign(this, stream);
    this.subscribers = hook();
  }

  override run(): Promise<void> {
    return this.stream.run();
  }

  override subscribe(callback: ((value: T) => any) | void): Subscription {

    if (!this.onEmission.contains(this, this.emit)) {
      this.onEmission.chain(this, this.emit);
    }

    this.stream.skipChainingOnSubscription = true;
    const subscription = this.stream.subscribe(callback);
    this.stream.skipChainingOnSubscription = false;

    return {
      unsubscribe: () => subscription.unsubscribe()
    };
  }

  override pipe(...operators: Operator[]): Subscribable<T> {
    this.operators = []; this.head = undefined; this.tail = undefined;
    operators.forEach((operator, index) => {
      if (operator instanceof Operator) {
        let clone = operator.clone(); clone.init(this)
        this.operators.push(clone);

        // Manage head and tail for every operator
        if (!this.head) {
          this.head = clone;
          this.tail = clone;
        } else {
          this.tail!.next = clone;
          this.tail = clone;
        }

        if ('outerStream' in clone && index !== operators.length - 1) {
          throw new Error("Only the last operator in a chunk can contain outerStream property.");
        }
      }
    });

    return this;
  }

  override async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      let next = (source instanceof Stream) ? this.head : undefined;
      next = (source instanceof Operator) ? source.next : next;

      if (this.isCancelled()) {
        emission.isCancelled = true;
      }

      // Process the emission with the next operator, if any
      emission = await (next?.process(emission, this) ?? Promise.resolve(emission));

      // If emission is valid, notify subscribers
      if (!(emission.isPhantom || emission.isCancelled || emission.isFailed)) {
        await this.subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      // Handle the error case
      emission.isFailed = true;
      emission.error = error;

      if (this.onError.length > 0) {
        await this.onError.process({ error });
      } else {
        this.isFailed.resolve(error);
      }
    }
  }
}
