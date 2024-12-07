export type Awaitable<T> = ReturnType<typeof createAwaitable<T>>;
export function createAwaitable<T>(initialValue?: any) {
  let _state: 'pending' | 'fullfilled' | 'rejected' = 'pending';
  let _value: any = initialValue;
  let _resolve!: (value: T) => void;
  let _reject!: (reason?: any) => void;

  let _promise = new Promise<T>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  function get() {
    return _value;
  }

  get.resolve = function (value: T): Promise<T> {
    if (_state !== 'pending') {
      throw new Error('Promise already settled');
    }

    _value = value;
    _state = 'fullfilled';
    _resolve(value);
    return _promise;
  };

  get.reject = function (reason?: any): Promise<T> {
    if (_state !== 'pending') {
      throw new Error('Promise already settled');
    }

    _state = 'rejected';
    _reject(reason);
    return _promise;
  };

  get.state = () => _state;
  get.promise = () => _promise;

  get.then = function <U = void>(callback: (value?: T) => U | PromiseLike<U>): Promise<U> {
    return _promise.then(callback);
  };

  return get;
}

createAwaitable.all = function (promises: Array<ReturnType<typeof createAwaitable<any>>>): Promise<any[]> {
  return Promise.all(promises.map(p => p.promise()));
};

createAwaitable.race = function (promises: Array<ReturnType<typeof createAwaitable<any>>>): Promise<any> {
  return Promise.race(promises.map(p => p.promise()));
};

export { createAwaitable as awaitable };
