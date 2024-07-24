import { AbstractStream } from './stream';

export abstract class AbstractHook {
  async process(stream: AbstractStream, params?: any): Promise<void> {
    throw new Error("Not implemented");
  }
}

