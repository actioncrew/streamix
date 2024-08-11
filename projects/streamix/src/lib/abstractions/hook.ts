import { Subscribable } from './subscribable';

// Define the Hook interface
export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init: (stream: Subscribable) => void;
}

// Define the HookType interface with support for initializing with other hooks
// Define HookType as an interface for the hook methods
export interface HookType {
  process(params?: any): Promise<void>;
  chain(callback: (params?: any) => void | Promise<void>): HookType;
  remove(callback: (params?: any) => void | Promise<void>): HookType;
  clear(): void;
  hasCallbacks(): boolean;
  callbacks(): ((params?: any) => void | Promise<void>)[];
  initWithHook(otherHook: HookType): HookType;
}

// Function to create a new hook
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

  function chain(this: HookType, callback: (params?: any) => void | Promise<void>): HookType {
    _callbacks.push(callback);
    return this;
  }

  function remove(this: HookType, callback: (params?: any) => void | Promise<void>): HookType {
    const index = _callbacks.findIndex((item) => item === callback);
    if (index !== -1) {
      _callbacks.splice(index, 1);
    }
    return this;
  }

  function clear(this: HookType): HookType {
    _callbacks.length = 0;
    return this;
  }

  function initWithHook(otherHook: HookType): HookType {
    const newHook = hook();
    otherHook.callbacks().forEach(callback => newHook.chain(callback));
    return newHook;
  }

  return {
    process,
    chain,
    remove,
    clear,
    hasCallbacks,
    callbacks,
    initWithHook
  };
}
