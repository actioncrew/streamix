type Callback = (params?: any) => Promise<any> | any;

export interface EventEmitter {
  on(event: string, callback: Callback): this;
  once(event: string, callback: Callback): this;
  off(event: string, callback: Callback): this;
  emit(event: string, params?: any): Promise<any[]>;
  waitForCompletion(event: string): Promise<void>;
  contains(event: string, callback: Callback): boolean;
  getCallbackCount(event: string): number;
  clear(): this;
}

export const createEventEmitter = (): EventEmitter => {
  const callbacks = new Map<string, Map<WeakRef<object>, Set<Callback>>>();
  const pendingCounts = new Map<string, number>();
  const waitingPromises = new Map<string, Promise<void>>();
  const resolveWaiters = new Map<string, () => void>();

  const getCallbackMap = (event: string) => {
    if (!callbacks.has(event)) {
      callbacks.set(event, new Map());
    }
    return callbacks.get(event)!;
  };

  const emit = async (event: string, params?: any): Promise<any[]> => {
    const promises: Promise<any>[] = [];
    const eventCallbacks = getCallbackMap(event);

    try {
      pendingCounts.set(event, (pendingCounts.get(event) ?? 0) + 1);

      for (const [ownerRef, callbacks] of eventCallbacks) {
        const owner = ownerRef.deref();
        if (owner) {
          for (const callback of callbacks) {
            promises.push(callback.call(owner, params));
          }
        } else {
          eventCallbacks.delete(ownerRef);
        }
      }

      return await Promise.all(promises);
    } finally {
      const remaining = (pendingCounts.get(event) ?? 1) - 1;
      pendingCounts.set(event, remaining);

      if (remaining === 0 && resolveWaiters.has(event)) {
        resolveWaiters.get(event)!();
        resolveWaiters.delete(event);
      }
    }
  };

  const waitForCompletion = async (event: string): Promise<void> => {
    if (!waitingPromises.has(event)) {
      waitingPromises.set(
        event,
        new Promise<void>((resolve) => {
          resolveWaiters.set(event, resolve);
        })
      );
    }

    return waitingPromises.get(event)!;
  };

  const on = (event: string, ownerOrCallback: object | Callback, callback?: Callback) => {
    const owner = ownerOrCallback instanceof Function ? api : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;

    const eventCallbacks = getCallbackMap(event);
    const ownerRef = new WeakRef(owner);

    if (!eventCallbacks.has(ownerRef)) {
      eventCallbacks.set(ownerRef, new Set());
    }
    eventCallbacks.get(ownerRef)!.add(callback);
    return api;
  };

  const once = (event: string, ownerOrCallback: object | Callback, callback?: Callback) => {
    const owner = ownerOrCallback instanceof Function ? api : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;

    const wrapper = async (params?: any) => {
      const result = await callback.call(owner, params);
      off(event, owner, wrapper);
      return result;
    };

    return on(event, owner, wrapper);
  };

  const off = (event: string, ownerOrCallback: object | Callback, callback?: Callback) => {
    const owner = ownerOrCallback instanceof Function ? api : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;

    const eventCallbacks = callbacks.get(event);
    if (!eventCallbacks) return api;

    for (const [ownerRef, callbacks] of eventCallbacks) {
      if (ownerRef.deref() === owner) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          eventCallbacks.delete(ownerRef);
        }
        break;
      }
    }

    if (eventCallbacks.size === 0) {
      callbacks.delete(event);
      pendingCounts.delete(event);
      waitingPromises.delete(event);
      resolveWaiters.delete(event);
    }

    return api;
  };

  const clear = (event?: string) => {
    if (event) {
      callbacks.delete(event);
      pendingCounts.delete(event);
      waitingPromises.delete(event);
      resolveWaiters.delete(event);
    } else {
      callbacks.clear();
      pendingCounts.clear();
      waitingPromises.clear();
      resolveWaiters.clear();
    }
    return api;
  };

  const contains = (event: string, ownerOrCallback: object | Callback, callback?: Callback) => {
    const owner = ownerOrCallback instanceof Function ? api : ownerOrCallback;
    callback = ownerOrCallback instanceof Function ? ownerOrCallback : callback!;

    const eventCallbacks = callbacks.get(event);
    if (!eventCallbacks) return false;

    for (const [ownerRef, callbacks] of eventCallbacks) {
      if (ownerRef.deref() === owner) {
        return callbacks.has(callback);
      }
    }
    return false;
  };

  const getCallbackNumber = (event: string) => {
    const eventCallbacks = callbacks.get(event);
    if (!eventCallbacks) return 0;

    let total = 0;
    for (const callbacks of eventCallbacks.values()) {
      total += callbacks.size;
    }
    return total;
  };

  const api: EventEmitter = {
    on,
    once,
    off,
    emit,
    waitForCompletion,
    clear,
    contains,
    getCallbackCount: getCallbackNumber,
  };

  return api;
};
