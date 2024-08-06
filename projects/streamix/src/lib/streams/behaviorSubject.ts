import { Emission, promisified } from '../../lib';
import { Subject } from './subject';

export class BehaviorSubject<T = any> extends Subject<T> {
  constructor(initialValue: T) {
    super();
    this.emissionQueue.push(promisified<Emission>({ value: initialValue }));
    this.emissionAvailable.resolve(true);
  }
}
