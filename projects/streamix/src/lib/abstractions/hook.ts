import { Subscribable } from './subscribable';

// Define the Hook interface
export interface Hook {
  callback: (params?: any) => void | Promise<void>;
  init: (stream: Subscribable) => void;
}

// Define HookType as an interface for the hook methods
export interface HookType {
  process(params?: any): Promise<void>;
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
    // Iterate over WeakMap entries to call all callbacks
    for (const [callback] of _callbackMap) {
      await callback(params);
    }
  }

  function chain(callback: (params?: any) => void | Promise<void>): HookType {
    // Add the callback to the WeakMap with undefined as the value
    if (!_callbackMap.has(callback)) {
      _callbackMap.set(callback, undefined);
    }
    return this;
  }

  function remove(callback: (params?: any) => void | Promise<void>): HookType {
    // Remove the callback from the WeakMap if it exists
    _callbackMap.delete(callback);
    return this;
  }

  function clear(): void {
    // Remove all entries from the WeakMap
    _callbackMap = new WeakMap<Function, undefined>();
  }

  function hasCallbacks(): boolean {
    // A WeakMap does not have a direct method to check if it contains entries
    // Use a method to check if WeakMap is non-empty indirectly
    return Array.from(_callbackMap.keys()).length > 0;
  }

  function callbacks(): ((params?: any) => void | Promise<void>)[] {
    // Collect all callback keys from WeakMap
    return Array.from(_callbackMap.keys());
  }

  return {
    process,
    chain,
    remove,
    clear,
    hasCallbacks,
    callbacks,
  };
}

