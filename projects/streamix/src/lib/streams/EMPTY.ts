import { Stream } from '../abstractions/stream';

export class EmptyStream<T = any> extends Stream<T> {
  constructor() {
    super();
  }

  override async run(): Promise<void> {
    this.isAutoComplete.resolve(true);
  }
}

export const EMPTY = new EmptyStream();
