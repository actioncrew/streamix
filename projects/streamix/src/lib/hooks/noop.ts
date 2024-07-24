import { AbstractStream } from '../abstractions';

export class NoopHook {
  async process(stream: AbstractStream, params?: any): Promise<void> {
    return Promise.resolve();
  }
}
