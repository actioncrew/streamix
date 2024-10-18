import { Subject, SubjectType } from './subject';

export function BehaviorSubject<T = any>(initialValue: T): SubjectType<T> {
  const instance = Subject<T>() as SubjectType<T>;

  queueMicrotask(() => {
    instance.emissionAvailable = (() =>
      instance.isRunning.then(() =>
        instance.emissionAvailable.then(() =>
          instance.onEmission.process({ emission: { value: initialValue }, source: instance })
        )
      ))();
  });

  return instance;
}
