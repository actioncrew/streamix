export class Promisified<T> {
  private _promise: Promise<T>;
  private _default: T;
  private _value: T;
  private _resolve!: (value: T) => void;
  private _reject!: (reason?: any) => void;

  constructor(initialValue: T) {
    this._value = initialValue;
    this._default = initialValue;
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  resolve(value: T): void {
    if (this._promise.then === undefined) {
      throw new Error('Promise already settled');
    }
    this._value = value;
    this._resolve(value);
  }

  reject(reason?: any): void {
    if (this._promise.then === undefined) {
      throw new Error('Promise already settled');
    }
    this._reject(reason);
  }

  get value() {
    return this._value;
  }

  get promise() {
    return this._promise;
  }

  reset() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      this._value = this._default;
    });
  }

  then<U = void>(callback: (value?: T) => U | PromiseLike<U>): Promise<U> {
    return this._promise.then(callback);
  }

  static all(promises: Array<Promisified<any>>): Promise<any[]> {
    return Promise.all(promises.map(p => p.promise));
  }

  static race(promises: Array<Promisified<any>>): Promise<any> {
    return Promise.race(promises.map(p => p.promise));
  }
}

function promisified<T>(initialValue: T) {
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

  Object.defineProperty(innerFunction, 'value', {
    get: function () {
      return _value;
    }
  });

  Object.defineProperty(innerFunction, 'promise', {
    get: function () {
      return _promise;
    }
  });

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

  innerFunction.all = function (promises: Array<ReturnType<typeof createPromisified<any>>>): Promise<any[]> {
    return Promise.all(promises.map(p => p.promise));
  };

  innerFunction.race = function (promises: Array<ReturnType<typeof createPromisified<any>>>): Promise<any> {
    return Promise.race(promises.map(p => p.promise));
  };

  return innerFunction;
}

