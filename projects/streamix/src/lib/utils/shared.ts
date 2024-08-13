export function shared<T>(initialValue: T) {
  let value = initialValue;
  const listeners: Array<(value: T) => void> = [];

  return {
    get: () => value,
    set: (newValue: T) => {
      if (value !== newValue) {
        value = newValue;
        for (const listener of listeners) {
          listener(value);
        }
      }
    },
    subscribe: (listener: (value: T) => void) => {
      listeners.push(listener);
      // Return an unsubscribe function
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    }
  };
}
