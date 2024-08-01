import { AbstractHook } from '../abstractions/hook';


export class StartWithHook extends AbstractHook {
  private hasEmitted = false;

  constructor(private value: any) {
    super();
  }

  override async process({ stream }: any): Promise<void> {
    if(!this.hasEmitted) {
      return stream.emit({ value: this.value }, stream.head!);
    }
  }
}

export function startWith(value: any) {
  return new StartWithHook(value);
}

