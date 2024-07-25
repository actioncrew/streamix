import { AbstractHook, AbstractStream } from '../abstractions';


export class CatchErrorHook extends AbstractHook {

  constructor(public handler: (error?: any) => void | Promise<void>) {
    super();
  }

  override async process(stream: AbstractStream, params?: any): Promise<void> {
    return this.handler(params.error);
  }
}

export function catchError(handler: (error?: any) => void | Promise<void>) {
  return new CatchErrorHook(handler);
}

