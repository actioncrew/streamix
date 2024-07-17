import { AbstractStream } from '../abstractions/stream';

export class FromEventStream extends AbstractStream {
  private element: HTMLElement;
  private eventName: string;

  constructor(element: HTMLElement, eventName: string) {
    super();
    this.element = element;
    this.eventName = eventName;
  }

  override async run(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const listener = async (event: Event) => {
        await this.emit({ value: event }); // Assuming you want to emit the entire event object
      };

      // Add event listener
      this.element.addEventListener(this.eventName, listener);

      // Unsubscribe function
      const unsubscribe = () => {
        this.element.removeEventListener(this.eventName, listener);
        resolve();
      }

      // Handle termination conditions
      Promise.race([
        this.isStopRequested.promise,
        this.isUnsubscribed.promise,
        this.isCancelled.promise,
        this.isFailed.promise,
      ]).then(() => {
        unsubscribe();
        resolve();
      }).catch((error) => {
        reject(error);
      });
    });
  }
}

export function fromEvent(element: HTMLElement, eventName: string) {
  return new FromEventStream(element, eventName);
}
