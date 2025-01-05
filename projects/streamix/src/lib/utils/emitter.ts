type Callback = (params?: any) => Promise<any> | any;

export interface EventEmitter {
  on(event: string, callback: Callback): this;
  once(event: string, callback: Callback): this;
  off(event: string, callback: Callback): this;
  emit(event: string, params?: any): Promise<any[]>;
  waitForCompletion(event: string): Promise<void>;
  clear(): this;
  contains(event: string, callback: Callback): boolean;
  readonly length: number;
}

export const EventEmitter = (): EventEmitter => {
  const callbacks = new Map<string, Set<Callback>>();
  const pendingEventPromises = new Map<string, Set<Promise<any>>>();

  const on = (event: string, callback: Callback) => {
    const eventCallbacks = callbacks.get(event) ?? new Set();
    eventCallbacks.add(callback);
    callbacks.set(event, eventCallbacks);
    return api;
  };

  const once = (event: string, callback: Callback) => {
    const wrapper = async (params?: any) => {
      await callback(params);
      off(event, wrapper);
    };
    return on(event, wrapper);
  };

  const off = (event: string, callback: Callback) => {
    const eventCallbacks = callbacks.get(event);
    if (eventCallbacks) {
      eventCallbacks.delete(callback);
      if (eventCallbacks.size === 0) {
        callbacks.delete(event);
      }
    }
    return api;
  };

  const emit = async (event: string, params?: any): Promise<any[]> => {
    const eventCallbacks = Array.from(callbacks.get(event) ?? []);
    const promises = eventCallbacks.map((callback) => callback(params));

    if (!pendingEventPromises.has(event)) {
      pendingEventPromises.set(event, new Set());
    }

    const eventPromiseSet = pendingEventPromises.get(event)!;
    promises.forEach((promise) => eventPromiseSet.add(promise));

    const results = await Promise.all(promises);

    // Clean up resolved promises for the event
    promises.forEach((promise) => eventPromiseSet.delete(promise));
    if (eventPromiseSet.size === 0) {
      pendingEventPromises.delete(event);
    }

    return results;
  };

  const waitForCompletion = async (event: string): Promise<void> => {
    const eventPromiseSet = pendingEventPromises.get(event);
    if (eventPromiseSet) {
      await Promise.all(Array.from(eventPromiseSet));
    }
  };

  const clear = () => {
    callbacks.clear();
    pendingEventPromises.clear();
    return api;
  };

  const contains = (event: string, callback: Callback) =>
    callbacks.has(event) && callbacks.get(event)!.has(callback);

  const length = () =>
    Array.from(callbacks.values()).reduce((total, cbSet) => total + cbSet.size, 0);

  const api: EventEmitter = {
    on,
    once,
    off,
    emit,
    waitForCompletion,
    clear,
    contains,
    get length() {
      return length();
    },
  };

  return api;
};
