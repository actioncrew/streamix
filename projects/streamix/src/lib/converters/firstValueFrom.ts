import { Converter } from '../abstractions/converter';
import { Subscribable } from '../abstractions/subscribable';

export class FirstValueFromConverter extends Converter<Subscribable, Promise<any>> {
  async convert(stream: Subscribable): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let hasEmitted = false;

      try {
        const unsubscribe = stream.subscribe((value) => {
          if (!hasEmitted) {
            hasEmitted = true;
            unsubscribe.unsubscribe();
            resolve(value);
          }
        })
      } catch(error) {
        reject(error);
      }
    });
  }
}

export function firstValueFrom(stream: Subscribable) {
  return new FirstValueFromConverter().convert(stream);
}
