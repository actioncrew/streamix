import { AbstractStream } from '../abstractions/stream';
import { PromisifiedCounter } from '../utils';

export class FromEventStream extends AbstractStream {
  private target: EventTarget;
  private eventName: string;
  private eventCounter: PromisifiedCounter;
  private listener!: (event: Event) => void;

  constructor(target: EventTarget, eventName: string) {
    super();
    this.target = target;
    this.eventName = eventName;
    this.eventCounter = new PromisifiedCounter(0);
  }

  override async run(): Promise<void> {
    this.listener = async (event: Event) => {
      if (this.isRunning.value) {
        this.eventCounter.increment();
        await this.emit({ value: event });
        this.eventCounter.decrement();
      }
    };

    this.target.addEventListener(this.eventName, this.listener);
    
    await Promise.race([this.awaitCompletion(), this.awaitTermination()]).then(() => {
      this.target.removeEventListener(this.eventName, this.listener);
    });
  }
}

export function fromEvent(target: EventTarget, eventName: string) {
  return new FromEventStream(target, eventName);
}
