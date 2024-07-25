import { AbstractHook, AbstractStream } from '../abstractions';


export class EndWithHook extends AbstractHook {
  private hasEmitted = false;

  constructor(private value: any) {
    super();
  }

  override async process(stream: AbstractStream): Promise<void> {
    if(!this.hasEmitted) {
      return stream.emit({ value: this.value });
    }
  }
}

export function endWith(value: any) {
  return new EndWithHook(value);
}

