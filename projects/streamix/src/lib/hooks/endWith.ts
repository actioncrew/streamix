import { AbstractHook, AbstractStream } from '../abstractions';


export class EndWithHook implements AbstractHook {
  private hasEmitted = false;

  constructor(private value: any) {

  }

  async process(stream: AbstractStream): Promise<void> {
    if(!this.hasEmitted) {
      return stream.emit({ value: this.value }, stream.head!);
    }
  }
}

export function endWith(value: any) {
  return new EndWithHook(value);
}

