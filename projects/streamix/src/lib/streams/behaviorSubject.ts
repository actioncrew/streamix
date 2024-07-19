import { Subject } from './subject';

export class BehaviorSubject extends Subject {
  constructor(initialValue: any) {
    super();
    this.emissionQueue.push(initialValue);
    this.emissionAvailable.resolve(true);
  }
}
