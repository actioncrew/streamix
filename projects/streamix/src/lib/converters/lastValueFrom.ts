import { AbstractConverter } from '../abstractions/converter';
import { AbstractStream } from '../abstractions/stream';

export class LastValueFromConverter extends AbstractConverter<AbstractStream, Promise<any>> {
  promise: Promise<boolean> | undefined;

  async convert(stream: AbstractStream): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let hasEmitted = false;
      let lastValue = undefined;

      try {
        this.promise = stream.isStopped.promise;
        const unsubscribe = stream.subscribe((value) => {
          lastValue = value; hasEmitted = true;
        });

        this.then(() => {
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

export function lastValueFrom(stream: AbstractStream) {
  return new LastValueFromConverter().convert(stream);
}
