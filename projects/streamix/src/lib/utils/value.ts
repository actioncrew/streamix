export function asyncValue<T>() {
  let _value: T | undefined;
  let _hasValue = false;
  let _resolve!: (value: T | PromiseLike<T>) => void;
  let _promise = new Promise<T>((resolve) => {
    _resolve = resolve;
  });

  async function innerFunction(): Promise<T> {
    return _hasValue ? Promise.resolve(_value as T) : _promise;
  }

  innerFunction.resolve = function (newValue: T): void {
    if (!_hasValue) {
      _value = newValue;
      _hasValue = true;
      _resolve(newValue);
    } else {
      _value = newValue;
    }
  };

  innerFunction.reset = function (): void {
    _value = undefined;
    _hasValue = false;
    _promise = new Promise<T>((resolve) => {
      _resolve = resolve;
    });
  };

  innerFunction.set = function (newValue: T): void {
    innerFunction.resolve(newValue);
  };

  innerFunction.hasValue = function (): boolean {
    return _hasValue;
  };

  return innerFunction;
}
