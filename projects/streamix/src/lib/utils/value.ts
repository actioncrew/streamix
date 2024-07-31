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

  innerFunction.getValue = function (): T | undefined {
    return _value;
  };

  innerFunction.setValue = function (newValue: T): void {
    innerFunction.resolve(newValue);
  };

  innerFunction.hasValue = function (): boolean {
    return _hasValue;
  };

  return innerFunction;
}
