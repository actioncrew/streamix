import { Subject } from './subject';

export class BehaviorSubject extends Subject {
  constructor(initialValue: any) {
    super();
    queueMicrotask(() => this.next(initialValue));
  }
}
