export function createAsyncValue<T>() {
  let _value: T | undefined;
  let _hasValue = false;
  let _resolve!: (value: T | PromiseLike<T>) => void;
  let _promise = new Promise<T>((resolve) => {
    _resolve = resolve;
  });

  async function get(): Promise<T> {
    return _hasValue ? Promise.resolve(_value as T) : _promise;
  }

  get.resolve = function (newValue: T): void {
    if (!_hasValue) {
      _value = newValue;
      _hasValue = true;
      _resolve(newValue);
    } else {
      _value = newValue;
    }
  };

  get.reset = function (): void {
    _value = undefined;
    _hasValue = false;
    _promise = new Promise<T>((resolve) => {
      _resolve = resolve;
    });
  };

  get.set = function (newValue: T): void {
    get.resolve(newValue);
  };

  get.hasValue = function (): boolean {
    return _hasValue;
  };

  get.value = function (): T | undefined {
    return _value;
  }

  return get;
}

export { createAsyncValue as asyncValue };
