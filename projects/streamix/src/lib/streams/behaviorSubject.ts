import { Subject } from './subject';

export class BehaviorSubject extends Subject {
  constructor(initialValue: any) {
    super();
    this.emissionQueue.push({ value: initialValue });
    this.emissionAvailable.resolve(true);
  }
}
