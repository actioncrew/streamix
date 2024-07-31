export class PromisifiedValue<T> {
  private _promise: Promise<T>;
  private _resolve!: (value: T | PromiseLike<T>) => void;
  private _value?: T;
  private _hasValue: boolean = false;

  constructor() {
    this._promise = new Promise<T>((resolve) => {
      this._resolve = (value) => resolve(value);
    });
  }

  set value(newValue: T) {
    if (!this._hasValue) {
      this._value = newValue;
      this._hasValue = true;
      this._resolve(newValue);
    } else {
      this._value = newValue;
    }
  }

  get value(): Promise<T> {
    return this._hasValue? Promise.resolve(this._value!) : this._promise;
  }

  get hasValue() {
    return this._hasValue;
  }
}

function promisifiedValue<T>() {
  let _value: T | undefined;
  let _hasValue = false;
  let _resolve!: (value: T | PromiseLike<T>) => void;

  const _promise = new Promise<T>((resolve) => {
    _resolve = (value) => resolve(value);
  });

  function innerFunction(): Promise<T> {
    return _hasValue ? Promise.resolve(_value as T) : _promise;
  }

  Object.defineProperty(innerFunction, 'value', {
    get: function () {
      return _hasValue ? Promise.resolve(_value as T) : _promise;
    },
    set: function (newValue: T) {
      if (!_hasValue) {
        _value = newValue;
        _hasValue = true;
        _resolve(newValue);
      } else {
        _value = newValue;
      }
    }
  });

  Object.defineProperty(innerFunction, 'hasValue', {
    get: function () {
      return _hasValue;
    }
  });

  return innerFunction;
}
