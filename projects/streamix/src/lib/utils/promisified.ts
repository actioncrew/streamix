export class Promisified<T> {
  private _promise: Promise<T>;
  private _value: T;
  private _resolve!: (value: T) => void; // Initialize with "!" for non-null assertion
  private _reject!: (reason?: any) => void;

  constructor(intialValue: any) {
    this._value = intialValue;
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve; // Assign resolve function
      this._reject = reject;  // Assign reject function
    });
  }

  public resolve(value: T): void {
    if (this._promise.then === undefined) {
      throw new Error('Promise already settled');
    }
    this._value = value;
    this._resolve(value);
  }

  public reject(reason?: any): void {
    if (this._promise.then === undefined) {
      throw new Error('Promise already settled');
    }
    this._reject(reason);
  }

  public get promise(): Promise<T> {
    return this._promise;
  }

  public get value() {
    return this._value;
  }

  reset() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve; // Assign resolve function
      this._reject = reject;  // Assign reject function
    });
  }
}
