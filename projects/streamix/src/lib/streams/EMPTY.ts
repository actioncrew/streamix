import { Stream } from '../abstractions/stream';

export class EmptyStream extends Stream {
  constructor() {
    super();
  }

  override async run(): Promise<void> {
    this.isAutoComplete.resolve(true);
  }
}

export const EMPTY = new EmptyStream();
