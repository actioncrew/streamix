import { Converter } from '../abstractions/converter';
import { Stream } from '../abstractions/stream';

export class LastValueFromConverter extends Converter<Stream, Promise<any>> {
  promise: Promise<boolean> | undefined;

  async convert(stream: Stream): Promise<any> {
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
            reject("Stream has not emitted any value.");
          }
          unsubscribe.unsubscribe();
        })
      } catch(error) {
        reject(error);
      }
    });
  }
}

export function lastValueFrom(stream: Stream) {
  return new LastValueFromConverter().convert(stream);
}
