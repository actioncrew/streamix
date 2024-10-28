// Define HookType as an interface for the hook methods
export interface HookType {
  process(params?: any): Promise<void>;
  parallel(params?: any): Promise<void>;
  chain(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType;
  once(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType;
  remove(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType;
  clear(this: HookType): HookType;
  contains(this: HookType, ownerOrCallback: object | Function, callback?: Function): boolean;
  length: number;
  scheduled: boolean;
}

export function hook(): HookType & { scheduled: boolean } {
  let callbackMap: Map<WeakRef<object>, Set<Function>> | null = null;
  let scheduled = false; // Flag to indicate if callbacks have been registered

  const getCallbackMap = () => {
    if (!callbackMap) callbackMap = new Map();
    return callbackMap;
  };

  async function process(params?: any): Promise<void> {
    if (!callbackMap) return; // If no callbacks have been added, skip processing
    for (const [ownerRef, callbacks] of callbackMap) {
      const owner = ownerRef.deref();
      if (owner) {
        for (const callback of callbacks) {
          await callback.call(owner, params);
        }
      } else {
        callbackMap.delete(ownerRef);
      }
    }
  }

  async function parallel(params?: any): Promise<void> {
    if (!callbackMap) return; // Skip if no callbacks have been added
    const promises: Promise<void>[] = [];
    for (const [ownerRef, callbacks] of callbackMap) {
      const owner = ownerRef.deref();
      if (owner) {
        for (const callback of callbacks) {
          promises.push(callback.call(owner, params));
        }
      } else {
        callbackMap.delete(ownerRef);
      }
    }
    await Promise.all(promises);
  }

  function chain(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType {
    const map = getCallbackMap(); // Ensure callbackMap is initialized
    const ownerRef = new WeakRef(ownerOrCallback instanceof Function ? this : ownerOrCallback);
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;

    // Mark as scheduled since a callback is being registered
    if (!scheduled) {
      scheduled = true;
    }

    if (!map.has(ownerRef)) {
      map.set(ownerRef, new Set());
    }
    map.get(ownerRef)!.add(callback);
    return this;
  }

  function once(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType {
    const owner = ownerOrCallback instanceof Function ? this : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;
    const wrapper = async (params?: any) => {
      await callback.call(owner, params);
      remove.call(this, owner, wrapper);
    };

    return chain.call(this, owner, wrapper);
  }

  function remove(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType {
    if (!callbackMap) return this; // Skip if callbackMap has not been initialized
    const owner = ownerOrCallback instanceof Function ? this : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;
    for (const [ownerRef, callbacks] of callbackMap) {
      if (ownerRef.deref() === owner) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          callbackMap.delete(ownerRef);
        }
        break;
      }
    }

    // Update the scheduled flag if there are no callbacks left
    if (callbackMap && callbackMap.size === 0) {
      scheduled = false;
    }

    return this;
  }

  function contains(this: HookType, ownerOrCallback: object | Function, callback?: Function): boolean {
    if (!callbackMap) return false; // Return false if callbackMap has not been initialized
    const owner = ownerOrCallback instanceof Function ? this : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;
    for (const [ownerRef, callbacks] of callbackMap) {
      if (ownerRef.deref() === owner) {
        return callbacks.has(callback);
      }
    }
    return false;
  }

  function clear(this: HookType): HookType {
    if (callbackMap) callbackMap.clear();
    scheduled = false; // Reset scheduled when cleared
    return this;
  }

  return {
    process,
    parallel,
    chain,
    once,
    remove,
    clear,
    contains,
    get scheduled() {
      return scheduled; // Expose scheduled flag
    },
    get length() {
      return callbackMap ? Array.from(callbackMap.values()).reduce((total, callbacks) => total + callbacks.size, 0) : 0;
    }
  };
}
