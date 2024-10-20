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
}

export function hook(): HookType {
  const callbackMap = new Map<WeakRef<object>, Set<Function>>();

  async function process(params?: any): Promise<void> {
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
    const ownerRef = new WeakRef(ownerOrCallback instanceof Function ? this : ownerOrCallback);
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;
    if (!callbackMap.has(ownerRef)) {
      callbackMap.set(ownerRef, new Set());
    }
    callbackMap.get(ownerRef)!.add(callback);
    return this;
  }

  function once(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType {
    const owner = ownerOrCallback instanceof Function ? this : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;
    const wrapper = async (params?: any) => {
      await callback(params);
      remove.call(this, owner, wrapper);
    };

    return chain.call(this, owner, wrapper);
  }

  function remove(this: HookType, ownerOrCallback: object | Function, callback?: Function): HookType {
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
    return this;
  }

  function contains(this: HookType, ownerOrCallback: object | Function, callback?: Function): boolean {
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
    callbackMap.clear();
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
    get length() {
      return Array.from(callbackMap.values()).reduce((total, callbacks) => total + callbacks.size, 0);
    }
  };
}
