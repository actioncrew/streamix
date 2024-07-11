import { AbstractStream } from '../abstractions/stream';

export class EmptyStream extends AbstractStream {
  constructor() {
    super();
  }

  override async run(): Promise<void> {
    this.isAutoComplete.resolve(true);
    return Promise.resolve();
  }
}

export const EMPTY = new EmptyStream();
