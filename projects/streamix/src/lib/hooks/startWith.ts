import { AbstractHook, AbstractStream } from '../abstractions';


export class StartWithHook implements AbstractHook {
  private hasEmitted = false;

  constructor(private value: any) {
  }

  async process(stream: AbstractStream): Promise<void> {
    if(!this.hasEmitted) {
      return stream.emit({ value: this.value });
    }
  }
}

export function startWith(value: any) {
  return new StartWithHook(value);
}

