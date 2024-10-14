import { Stream } from '../abstractions';
import { hook } from '../utils';
import { Emission } from './emission';
import { Operator } from './operator';
import { Subscribable } from './subscribable';

export class Chunk<T = any> extends Stream<T> implements Subscribable<T> {
  operators: Operator[] = [];
  head: Operator | undefined;
  tail: Operator | undefined;

  constructor(public stream: Stream<T>) {
    super();
    Object.assign(this, stream);
    this.subscribers = hook();
    this.onEmission = hook();
  }

  override start() {
    if (!this.stream.onEmission.contains(this, this.emit)) {
      this.stream.onEmission.chain(this, this.emit);
    }

    if (this.isRunning() === false) {
      this.isRunning.resolve(true);

      queueMicrotask(async () => {
        try {
          // Emit start value if defined
          await this.onStart.process();

          // Start the actual stream logic
          await this.run();

          // Emit end value if defined
          await this.onComplete.process();
        } catch (error) {
          this.isFailed.resolve(error);

          if(this.onError.length > 0) {
            await this.onError.process({ error });
          }
        } finally {
          // Handle finalize callback
          await this.onStop.process();
          this.stream.onEmission.remove(this, this.emit);

          this.isStopped.resolve(true);
          this.isRunning.reset();
        }
      });
    }
  }

  override run(): Promise<void> {
    return this.stream.run();
  }

  override pipe(...operators: Operator[]): Subscribable<T> {
    this.operators = []; this.head = undefined; this.tail = undefined;
    operators.forEach((operator, index) => {
      if (operator instanceof Operator) {
        let clone = operator.clone(); clone.init(this.stream)
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

      if(emission.isFailed) {
        throw emission.error;
      }

      if(!emission.isPhantom) {
        // Process the emission with the next operator, if any
        emission = await (next?.process(emission, this) ?? Promise.resolve(emission));
      }

      if(emission.isFailed) {
        throw emission.error;
      }
      // If emission is valid, notify subscribers
      if (!emission.isPhantom) {
        await this.onEmission.parallel({ emission, source: this });
        await this.subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;

      this.isFailed.resolve(error);
      if(this.onError.length > 0) {
        await this.onError.process({ error });
      }
    }
  }
}
