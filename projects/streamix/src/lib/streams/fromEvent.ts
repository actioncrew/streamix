import { Stream, Subscription } from '../abstractions';
import { counter } from '../utils';

export class FromEventStream extends Stream {
  private target: EventTarget;
  private eventName: string;
  private eventCounter = counter(0);
  private listener!: (event: Event) => void;

  constructor(target: EventTarget, eventName: string) {
    super();
    this.target = target;
    this.eventName = eventName;
  }

  override async run(): Promise<void> {

    await Promise.race([this.awaitCompletion(), this.awaitTermination()]).then(() => {
      this.target.removeEventListener(this.eventName, this.listener);
    });
  }

  override subscribe(callback: void | ((value: any) => any)): Subscription {
    this.listener = async (event: Event) => {
      if (this.isRunning()) {
        this.eventCounter.increment();
        await this.onEmission.process({ emission: { value: event }, source: this });
        this.eventCounter.decrement();
      }
    };

    this.target.addEventListener(this.eventName, this.listener);

    return super.subscribe(callback);
  }
}

export function fromEvent(target: EventTarget, eventName: string) {
  return new FromEventStream(target, eventName);
}
