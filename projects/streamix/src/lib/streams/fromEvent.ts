import { AbstractStream } from '../abstractions/stream';
import { PromisifiedCounter } from '../utils';

export class FromEventStream extends AbstractStream {
  private element: HTMLElement;
  private eventName: string;
  private eventCounter: PromisifiedCounter;
  private stopped = false;

  constructor(element: HTMLElement, eventName: string) {
    super();
    this.element = element;
    this.eventName = eventName;
    this.eventCounter = new PromisifiedCounter(0);
  }

  override async run(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      const listener = async (event: Event) => {
        this.eventCounter.increment();
        await this.emit({ value: event }); // Assuming you want to emit the entire event object
        this.eventCounter.decrement();
      };

      // Add event listener
      this.element.addEventListener(this.eventName, listener);

      // Unsubscribe function
      const unsubscribe = () => {
        this.element.removeEventListener(this.eventName, listener);
        resolve();
      };

      this.eventCounter.subscribe(() => {
        if(this.stopped) {
          unsubscribe();
          resolve();
        }
      })
      // Handle termination conditions
      let promise = Promise.race([
        this.isStopRequested.promise,
        this.isUnsubscribed.promise,
        this.isCancelled.promise,
        this.isFailed.promise,
      ]).then(() => {
        this.stopped = true;
      }).catch((error) => {
        reject(error);
      });
    });
  }
}

export function fromEvent(element: HTMLElement, eventName: string) {
  return new FromEventStream(element, eventName);
}
