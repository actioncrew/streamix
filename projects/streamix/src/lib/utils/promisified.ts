export function promisified<T>(initialValue: T) {
  let _value: T = initialValue;
  let _resolve: ((value: T) => void) | undefined;
  let _reject: ((reason?: any) => void) | undefined;
  let _promise: Promise<T> | undefined;

  const resolve = (value: T) => {
    if (!_promise) {
      createPromise(); // Ensure the promise is instantiated
    }
    if (_resolve) {
      _value = value;
      _resolve(value);
      _resolve = undefined;
      _reject = undefined;
    } else {
      throw new Error('Promise already settled');
    }
  };

  const reject = (reason?: any) => {
    if (!_promise) {
      createPromise(); // Ensure the promise is instantiated
    }
    if (_reject) {
      _reject(reason);
      _resolve = undefined;
      _reject = undefined;
    } else {
      throw new Error('Promise already settled');
    }
  };

  const reset = () => {
    _value = initialValue;
    _promise = undefined; // Reset the promise
  };

  const createPromise = () => {
    _promise = new Promise<T>((resolve, reject) => {
      _resolve = resolve;
      _reject = reject;
    });
  };

  const fn = function () {
    return _value;
  } as {
    (): T;
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: any) => void;
    reset: () => void;
    then: (onFulfilled: (value: T) => void, onRejected?: (reason: any) => void) => Promise<void>;
  };

  Object.defineProperties(fn, {
    promise: {
      get() {
        if (!_promise) {
          createPromise(); // Ensure the promise is instantiated
        }
        return _promise;
      },
      enumerable: true
    },
    resolve: {
      value: resolve,
      enumerable: true
    },
    reject: {
      value: reject,
      enumerable: true
    },
    reset: {
      value: reset,
      enumerable: true
    },
    then: {
      value: function (onFulfilled: (value: T) => void, onRejected?: (reason: any) => void) {
        return fn.promise.then(onFulfilled, onRejected);
      },
      enumerable: true
    }
  });

  return fn;
}

promisified.all = function (promises: Array<ReturnType<typeof promisified<any>>>): Promise<any[]> {
  return Promise.all(promises.map(p => p.promise));
};

promisified.race = function (promises: Array<ReturnType<typeof promisified<any>>>): Promise<any> {
  return Promise.race(promises.map(p => p.promise));
};
