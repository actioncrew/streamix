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
    return new Promise<void>((resolve) => {
      const listener = (event: Event) => {
        this.emit({ value: event });
      };

      this.element.addEventListener(this.eventName, listener);

      this.unsubscribe = () => {
        this.element.removeEventListener(this.eventName, listener);
        resolve();
      };
    });
  }
}

export function fromEvent(element: HTMLElement, eventName: string) {
  return new FromEventStream(element, eventName);
}
