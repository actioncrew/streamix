import { Subject } from './subject';

export class BehaviorSubject extends Subject {
  constructor(initialValue: any) {
    super();
    this.next(initialValue);
  }
}
