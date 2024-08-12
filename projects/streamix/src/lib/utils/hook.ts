// Define HookType as an interface for the hook methods
export interface HookType {
  process(params?: any): Promise<void>;
  parallel(params?: any): Promise<void>;
  chain(this: HookType, owner: object, callback: (params?: any) => void | Promise<void>): HookType;
  remove(this: HookType, owner: object, callback: (params?: any) => void | Promise<void>): HookType;
  clear(this: HookType): HookType;
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

  function chain(this: HookType, owner: object, callback: (params?: any) => void | Promise<void>): HookType {
    const ownerRef = new WeakRef(owner);
    if (!callbackMap.has(ownerRef)) {
      callbackMap.set(ownerRef, new Set());
    }
    callbackMap.get(ownerRef)!.add(callback);
    return this;
  }

  function remove(this: HookType, owner: object, callback: (params?: any) => void | Promise<void>): HookType {
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

  function clear(this: HookType): HookType {
    callbackMap.clear();
    return this;
  }

  return {
    process,
    parallel,
    chain,
    remove,
    clear,
    get length() {
      return Array.from(callbackMap.values()).reduce((total, callbacks) => total + callbacks.size, 0);
    }
  };
}
