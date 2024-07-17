export class PromisifiedValue<T> {
  private _promise: Promise<T>;
  private _resolve!: (value: T | PromiseLike<T>) => void;
  private _value?: T;
  private _hasValue: boolean = false;

  constructor() {
    this._promise = new Promise<T>((resolve) => {
      this._resolve = resolve;
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
