export function promisified<T>(initialValue: T) {
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

promisified.all = function (promises: Array<ReturnType<typeof promisified<any>>>): Promise<any[]> {
  return Promise.all(promises.map(p => p.promise));
};

promisified.race = function (promises: Array<ReturnType<typeof promisified<any>>>): Promise<any> {
  return Promise.race(promises.map(p => p.promise));
};
