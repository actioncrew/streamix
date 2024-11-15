export interface Hook {
  process(params?: any): Promise<void>;
  parallel(params?: any): Promise<void>;
  chain(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook;
  once(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook;
  remove(this: Hook, ownerOrCallback: object | Function, callback?: Function): Hook;
  clear(this: Hook): Hook;
  contains(this: Hook, ownerOrCallback: object | Function, callback?: Function): boolean;
  waitUntilComplete(): Promise<void>;
  length: number;
  scheduled: boolean;
}

export function hook(): Hook & { scheduled: boolean } {
  let callbackMap: Map<WeakRef<object>, Set<Function>> | null = null;
  let scheduled = false;
  let completionPromise: Promise<void> | null = null;

  const getCallbackMap = () => {
    if (!callbackMap) callbackMap = new Map();
    return callbackMap;
  };

  async function process(params?: any): Promise<void> {
    if (!callbackMap) return;

    // Create a completion promise that resolves when all callbacks are finished
    completionPromise = (async () => {
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
    })();

    await completionPromise;
  }

  async function parallel(params?: any): Promise<void> {
    if (!callbackMap) return;

    // Create a completion promise that resolves when all callbacks are finished
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

    completionPromise = Promise.all(promises).then(() => {});
    await completionPromise;
  }

  async function waitUntilComplete(): Promise<void> {
    const map = getCallbackMap();
    if(map.size > 0) {
      while (!completionPromise) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      await completionPromise;
    }
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
      await callback.call(owner, params);
      remove.call(this, owner, wrapper);
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
    process,
    parallel,
    chain,
    once,
    remove,
    clear,
    contains,
    waitUntilComplete,
    get scheduled() {
      return scheduled;
    },
    get length() {
      return callbackMap ? Array.from(callbackMap.values()).reduce((total, callbacks) => total + callbacks.size, 0) : 0;
    }
  };
}
