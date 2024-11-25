export type Awaitable<T> = ReturnType<typeof awaitable<T>>;
export function awaitable<T>(initialValue?: any) {
  let _state: 'pending' | 'fullfilled' | 'rejected' = 'pending';
  let _value: any = initialValue;
  let _resolve!: (value: T) => void;
  let _reject!: (reason?: any) => void;

  let _promise = new Promise<T>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  function innerFunction() {
    return _value;
  }

  innerFunction.resolve = function (value: T): Promise<T> {
    if (_state !== 'pending') {
      throw new Error('Promise already settled');
    }

    _value = value;
    _state = 'fullfilled';
    _resolve(value);
    return _promise;
  };

  innerFunction.reject = function (reason?: any): Promise<T> {
    if (_state !== 'pending') {
      throw new Error('Promise already settled');
    }

    _state = 'rejected';
    _reject(reason);
    return _promise;
  };

  innerFunction.state = () => _state;
  innerFunction.promise = () => _promise;

  innerFunction.then = function <U = void>(callback: (value?: T) => U | PromiseLike<U>): Promise<U> {
    return _promise.then(callback);
  };

  return innerFunction;
}

awaitable.all = function (promises: Array<ReturnType<typeof awaitable<any>>>): Promise<any[]> {
  return Promise.all(promises.map(p => p.promise()));
};

awaitable.race = function (promises: Array<ReturnType<typeof awaitable<any>>>): Promise<any> {
  return Promise.race(promises.map(p => p.promise()));
};
