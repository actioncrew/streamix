export function promisified1<T>(initialValue: T) {
  let _value = initialValue;
  let _default = initialValue;
  let _resolve!: (value: T) => void;
  let _reject!: (reason?: any) => void;

  let _promise = new Promise<T>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  function innerFunction() {
    return _value;
  }

  innerFunction.resolve = function (value: T): void {
    if (_promise.then === undefined) {
      throw new Error('Promise already settled');
    }
    _value = value;
    _resolve(value);
  };

  innerFunction.reject = function (reason?: any): void {
    if (_promise.then === undefined) {
      throw new Error('Promise already settled');
    }
    _reject(reason);
  };

  innerFunction.promise = _promise;

  innerFunction.reset = function () {
    _promise = new Promise<T>((resolve, reject) => {
      _resolve = resolve;
      _reject = reject;
      _value = _default;
    });
  };

  innerFunction.then = function <U = void>(callback: (value?: T) => U | PromiseLike<U>): Promise<U> {
    return _promise.then(callback);
  };

  return innerFunction;
}

export function promisified<T>(initialValue: T) {
  let _value: T = initialValue;
  let _resolve: ((value: T) => void) | undefined;
  let _reject: ((reason?: any) => void) | undefined;
  let _promise: Promise<T> | undefined;

  const resolve = (value: T) => {
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

  // Define the function and cast it to include the properties
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
          _promise = new Promise<T>((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
          });
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
