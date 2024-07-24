import { AbstractStream } from '../abstractions/stream';
import { PromisifiedCounter } from '../utils';

export class FromEventStream extends AbstractStream {
  private target: EventTarget; // This will support both HTMLElement and window
  private eventName: string;
  private eventCounter: PromisifiedCounter;
  private stopped = false;

  constructor(target: EventTarget, eventName: string) {
    super();
    this.target = target;
    this.eventName = eventName;
    this.eventCounter = new PromisifiedCounter(0);

    queueMicrotask(() => {
      const listener = async (event: Event) => {
        this.eventCounter.increment();
        await this.emit({ value: event });
        this.eventCounter.decrement();
      };

      // Add event listener
      this.target.addEventListener(this.eventName, listener);

      // Unsubscribe function
      const unsubscribe = () => {
        this.target.removeEventListener(this.eventName, listener);
      };

      this.eventCounter.subscribe(() => {
        if(this.stopped) {
          unsubscribe();
        }
      });
    });
  }

  override async run(): Promise<void> {
    return Promise.race([this.awaitCompletion(), this.awaitTermination()]).then(() => {
      this.stopped = true;
    });
  }
}

export function fromEvent(target: EventTarget, eventName: string) {
  return new FromEventStream(target, eventName);
}
