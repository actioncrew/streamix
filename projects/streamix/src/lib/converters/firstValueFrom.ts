import { AbstractConverter } from '../abstractions/converter';
import { AbstractStream } from '../abstractions/stream';

export class FirstValueFromConverter extends AbstractConverter<AbstractStream, Promise<any>> {
  async convert(stream: AbstractStream): Promise<any> {
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

export function firstValueFrom(stream: AbstractStream) {
  return new FirstValueFromConverter().convert(stream);
}
