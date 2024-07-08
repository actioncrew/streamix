import { AbstractStream } from '../abstractions/stream';

export class EmptyStream extends AbstractStream {
  constructor() {
    super();
  }

  run(): Promise<void> {
    this.isAutoComplete = true;
    return Promise.resolve();
  }
}

export function EMPTY() {
  return new EmptyStream();
}
