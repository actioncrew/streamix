import { Subject } from './subject';

export class BehaviorSubject<T = any> extends Subject<T> {
  constructor(initialValue: T) {
    super();
    this.emissionQueue.push({ value: initialValue });
    this.emissionAvailable.resolve(true);
  }
}
