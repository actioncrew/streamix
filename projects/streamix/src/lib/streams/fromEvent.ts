import { Stream } from '../abstractions';
import { counter } from '../utils';

export class FromEventStream<T = any> extends Stream<T> {
  private eventCounter = counter(0);
  private listener!: (event: Event) => void;
  private usedContext!: any;

  constructor(private readonly target: EventTarget, private readonly eventName: string) {
    super();
  }

  async run(): Promise<void> {
    await this.awaitCompletion();
    this.target.removeEventListener(this.eventName, this.listener);
  }

  override subscribe(callback?: (value: T) => any) {
    if(!this.listener) {
      this.listener = async (event: Event) => {
        if (this.isRunning) {
          this.eventCounter.increment();
          await this.onEmission.parallel({ emission: { value: event }, source: this });
          this.eventCounter.decrement();
        }
      };

      this.target.addEventListener(this.eventName, this.listener);
    }

    return super.subscribe(callback);
  }
}

export function fromEvent<T = any>(target: EventTarget, eventName: string) {
  return new FromEventStream<T>(target, eventName);
}
