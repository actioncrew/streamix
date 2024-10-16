import { Subject } from './subject';

export class BehaviorSubject<T = any> extends Subject<T> {
  constructor(private readonly initialValue: T) {
    super();
    queueMicrotask(() => this.emissionAvailable = (() => this.isRunning.then(() => this.emissionAvailable).then(() => this.onEmission.process({ emission: { value: initialValue }, source: this })))());
  }
}
