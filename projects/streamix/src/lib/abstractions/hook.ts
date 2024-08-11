import { Subscribable } from './subscribable';

// Define the Hook interface
export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init: (stream: Subscribable) => void;
}

// Define HookType as an interface for the hook methods
export interface HookType {
  process(params?: any): Promise<void>;
  parallel(params?: any): Promise<void>;
  chain(callback: (params?: any) => void | Promise<void>): HookType;
  remove(callback: (params?: any) => void | Promise<void>): HookType;
  clear(): void;
  hasCallbacks(): boolean;
  callbacks(): ((params?: any) => void | Promise<void>)[];
}

export function hook(): HookType {
  // WeakMap to track callbacks with undefined values
  const _callbackMap = new WeakMap<Function, undefined>();

  async function process(params?: any): Promise<void> {
    for (const [callback] of _callbackMap) {
      await callback(params);
    }
  }

  async function parallel(params?: any): Promise<void> {
    const promises = Array.from(_callbackMap.keys()).map(callback => callback(params));
    await Promise.all(promises);
  }

  function chain(callback: (params?: any) => void | Promise<void>): HookType {
    if (!_callbackMap.has(callback)) {
      _callbackMap.set(callback, undefined);
    }
    return this;
  }

  function remove(callback: (params?: any) => void | Promise<void>): HookType {
    _callbackMap.delete(callback);
    return this;
  }

  function clear(): void {
    // Reinitialize _callbackMap to clear all entries
    _callbackMap = new WeakMap<Function, undefined>();
  }

  function hasCallbacks(): boolean {
    // Check if there are any entries in the WeakMap
    return Array.from(_callbackMap.keys()).length > 0;
  }

  function callbacks(): ((params?: any) => void | Promise<void>)[] {
    return Array.from(_callbackMap.keys());
  }

  return {
    process,
    parallel,
    chain,
    remove,
    clear,
    hasCallbacks,
    callbacks,
  };
}
