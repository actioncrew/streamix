import { Subscribable } from './subscribable';

// Define the Hook interface
export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init: (stream: Subscribable) => void;
}

// Define the HookType interface with support for initializing with other hooks
export interface HookType {
  process(params?: any): Promise<void>;
  chain(callback: (params?: any) => void | Promise<void>): void;
  remove(callback: (params?: any) => void | Promise<void>): void;
  clear(): void;
  callbacks(): ((params?: any) => void | Promise<void>)[];
  hasCallbacks(): boolean;
  initWithHook(hook: HookType): HookType; // Add a method to initialize with another hook
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

  function initWithHook(otherHook: HookType): HookType {
    let newHook = hook();
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
