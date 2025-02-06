export const catchAny = async <T>(promiseOrFunction: Promise<T> | (() => T)): Promise<[undefined, T] | [Error]> => {
  try {
    // If it's a function, execute it and handle any synchronous errors.
    const result = typeof promiseOrFunction === 'function' ? promiseOrFunction() : promiseOrFunction;

    // If result is a Promise, await it to handle asynchronous errors.
    const data = await result;
    return [undefined, data] as [undefined, T];
  } catch (error) {
    // Catch both synchronous and asynchronous errors.
    return [error as Error];
  }
};

