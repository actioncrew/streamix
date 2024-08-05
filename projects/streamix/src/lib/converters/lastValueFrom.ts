import { Converter } from '../abstractions/converter';
import { Subscribable } from '../abstractions/subscribable';

export class LastValueFromConverter extends Converter<Subscribable, Promise<any>> {
  promise: Promise<boolean> | undefined;

  async convert(stream: Subscribable): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let hasEmitted = false;
      let lastValue = undefined;

      try {
        this.promise = stream.isStopped.promise;
        const unsubscribe = stream.subscribe((value) => {
          lastValue = value; hasEmitted = true;
        });

        this.promise.then(() => {
          if(hasEmitted) {
            resolve(lastValue!);
          } else {
            reject("Subscribable has not emitted any value.");
          }
          unsubscribe.unsubscribe();
        })
      } catch(error) {
        reject(error);
      }
    });
  }
}

export function lastValueFrom(stream: Subscribable) {
  return new LastValueFromConverter().convert(stream);
}
