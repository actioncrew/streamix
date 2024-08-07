import { Stream } from './stream';

export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init:(stream: Stream) => void;
}

export interface HookType {
  process(params?: any): Promise<void>;
  chain(callback: (params?: any) => void | Promise<void>): void;
  clear(): void;
}

export function hook(): HookType {
  let boundStream = undefined;
  const callbacks: ((params?: any) => void | Promise<void>)[] = [];

  async function process(params?: any): Promise<void> {
    for (const callback of callbacks) {
      await callback(params);
    }
  }

  function chain(callback: (params?: any) => void | Promise<void>): void {
    callbacks.push(callback);
  }

  function clear(): void {
    callbacks.length = 0;
  }

  return {
    process,
    chain,
    clear,
  };
}
