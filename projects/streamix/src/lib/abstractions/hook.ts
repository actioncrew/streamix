import { Stream } from './stream';

export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init:(stream: Stream) => void;
}

export interface HookType {
  process(params?: any): Promise<void>;
  chain(callback: (params?: any) => void | Promise<void>): void;
  remove(callback: (params?: any) => void | Promise<void>): void;
  clear(): void;
  callbacks(): ((params?: any) => void | Promise<void>)[]
  hasCallbacks(): boolean;
}

export function hook(): HookType {
  const _callbacks: ((params?: any) => void | Promise<void>)[] = [];

  function callbacks(): ((params?: any) => void | Promise<void>)[] {
    return _callbacks;
  }

  function hasCallbacks(): boolean {
    return _callbacks.length > 0;
  }

  async function process(params?: any): Promise<void> {
    for (const callback of _callbacks) {
      await callback(params);
    }
  }

  function chain(callback: (params?: any) => void | Promise<void>): void {
    _callbacks.push(callback);
  }

  function remove(callback: (params?: any) => void | Promise<void>): void {
    const index = _callbacks.findIndex((item) => item === callback);
    if (index !== -1) {
      _callbacks.splice(index, 1);
    }
  }

  function clear(): void {
    _callbacks.length = 0;
  }

  return {
    process,
    chain,
    remove,
    clear,
    hasCallbacks,
    callbacks
  };
}
