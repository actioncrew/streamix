import { AbstractHook } from '../abstractions/hook';


export class CatchErrorHook extends AbstractHook {

  constructor(public handler: (error?: any) => void | Promise<void>) {
    super();
  }

  override async process({ stream, error }: any): Promise<void> {
    return this.handler(error);
  }
}

export function catchError(handler: (error?: any) => void | Promise<void>) {
  return new CatchErrorHook(handler);
}

