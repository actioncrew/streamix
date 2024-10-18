import { Stream } from '../../lib';

export interface SubjectType<T = any> extends ReturnType<typeof Stream<T>> {
  currentValue: T | undefined;
  emissionAvailable: Promise<void>;
  next(value?: T): Promise<void>;
}

export function Subject<T = any>(): SubjectType<T> {
  const instance = Stream<T>() as SubjectType<T>;

  instance.currentValue = undefined;
  instance.emissionAvailable = Promise.resolve();

  instance.run = async (): Promise<void> => {
    await instance.awaitCompletion();
    return instance.emissionAvailable;
  };

  instance.next = async (value?: T): Promise<void> => {
    if (instance.isStopped()) {
      console.warn('Cannot push value to a stopped Subject.');
      return Promise.resolve();
    }

    instance.emissionAvailable = instance.emissionAvailable.then(() =>
      instance.onEmission.process({ emission: { value }, source: instance })
    );

    return instance.emissionAvailable;
  };

  // Return the callable instance
  return instance;
}
