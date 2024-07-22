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
