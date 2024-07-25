import { AbstractHook, AbstractStream } from '../abstractions';


export class StartWithHook extends AbstractHook {
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

export function startWith(value: any) {
  return new StartWithHook(value);
}

