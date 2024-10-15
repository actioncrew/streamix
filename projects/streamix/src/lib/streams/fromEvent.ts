import { Stream, Subscription } from '../abstractions';
import { counter } from '../utils';

export class FromEventStream<T = any> extends Stream<T> {
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
    await this.awaitCompletion();
    this.target.removeEventListener(this.eventName, this.listener);
  }

  override start(context: any) {
    this.listener = async (event: Event) => {
      if (this.isRunning()) {
        this.eventCounter.increment();
        await this.onEmission.process({ emission: { value: event }, source: this });
        this.eventCounter.decrement();
      }
    };

    this.target.addEventListener(this.eventName, this.listener);

    return super.start(context);
  }
}

export function fromEvent<T = any>(target: EventTarget, eventName: string) {
  return new FromEventStream<T>(target, eventName);
}
