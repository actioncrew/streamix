import { AbstractHook, AbstractStream } from '../abstractions';


export class CatchErrorHook implements AbstractHook {

  constructor(public handler: (error?: any) => void | Promise<void>) {
  }

  async process(stream: AbstractStream, params?: any): Promise<void> {
    return this.handler(params.error);
  }
}

export function catchError(handler: (error?: any) => void | Promise<void>) {
  return new CatchErrorHook(handler);
}

