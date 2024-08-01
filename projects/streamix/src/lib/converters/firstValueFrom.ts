import { Converter } from '../abstractions/converter';
import { Stream } from '../abstractions/stream';

export class FirstValueFromConverter extends Converter<Stream, Promise<any>> {
  async convert(stream: Stream): Promise<any> {
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

export function firstValueFrom(stream: Stream) {
  return new FirstValueFromConverter().convert(stream);
}
