// Define HookType as an interface for the hook methods
export interface Hook {
  invoke(params?: any): Promise<any[]>;
  parallel(params?: any): Promise<any[]>;
  chain(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook;
  once(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook;
  remove(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook;
  clear(this: Hook): Hook;
  contains(this: Hook, ownerOrCallback: object | Function, callback?: Function): boolean;
  waitForCompletion(): Promise<void>;
  length: number;
}

export function createHook(): Hook {
  let callbackMap: Map<WeakRef<object>, Set<Function>> | null = null;
  let scheduled = false;
  let resolveWait: (() => void) | null = null;
  let waitingPromise: Promise<void> = Promise.resolve();
  let pendingCount = 0;

  const getCallbackMap = () => {
    if (!callbackMap) callbackMap = new Map();
    return callbackMap;
  };

  async function invoke(params?: any): Promise<any[]> {
    const results: any[] = [];
    try {
      if (!callbackMap) return results; // Return an empty array if no callbacks
      for (const [ownerRef, callbacks] of callbackMap) {
        const owner = ownerRef.deref();
        if (owner) {
          for (const callback of callbacks) {
            results.push(await callback.call(owner, params));
          }
        } else {
          callbackMap.delete(ownerRef);
        }
      }
    } finally {
      resolveWait && resolveWait();
      pendingCount = 0;
    }
    return results;
  }

  async function parallel(params?: any): Promise<any[]> {
    const promises: Promise<any>[] = [];
    try {
      if (!callbackMap) return promises; // Return an empty array if no callbacks
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
      return await Promise.all(promises);
    } finally {
      resolveWait && resolveWait();
      pendingCount = 0;
    }
  }

  async function waitForCompletion(this: Hook): Promise<void> {
    // Prepare to wait for future processes to complete (if there are any)
    if(!pendingCount) {
      waitingPromise = new Promise<void>((resolve) => {
        resolveWait = resolve;
      });
    }

    pendingCount++;
    return waitingPromise;
  }

  function chain(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook {
    const map = getCallbackMap();
    const ownerRef = new WeakRef(ownerOrCallback instanceof Function ? this : ownerOrCallback);
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;

    if (!scheduled) {
      scheduled = true;
    }

    if (!map.has(ownerRef)) {
      map.set(ownerRef, new Set());
    }
    map.get(ownerRef)!.add(callback);
    return this;
  }

  function once(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook {
    const owner = ownerOrCallback instanceof Function ? this : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;
    const wrapper = async (params?: any) => {
      const result = await callback.call(owner, params);
      remove.call(this, owner, wrapper);
      return result;
    };

    return chain.call(this, owner, wrapper);
  }

  function remove(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook {
    if (!callbackMap) return this;
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

    if (callbackMap && callbackMap.size === 0) {
      scheduled = false;
    }

    return this;
  }

  function contains(this: Hook, ownerOrCallback: object | Function, callback?: Function): boolean {
    if (!callbackMap) return false;
    const owner = ownerOrCallback instanceof Function ? this : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;
    for (const [ownerRef, callbacks] of callbackMap) {
      if (ownerRef.deref() === owner) {
        return callbacks.has(callback);
      }
    }
    return false;
  }

  function clear(this: Hook): Hook {
    if (callbackMap) callbackMap.clear();
    scheduled = false;
    return this;
  }

  return {
    invoke,
    parallel,
    chain,
    once,
    remove,
    clear,
    contains,
    waitForCompletion,
    get length() {
      if (!callbackMap) { return 0; }
      let total = 0;
      for (const callbacks of callbackMap.values()) {
        total += callbacks.size;
      }
      return total;
    }
  };
}

export { createHook as hook };
