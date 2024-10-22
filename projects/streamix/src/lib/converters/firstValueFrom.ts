import { Converter } from '../abstractions/converter';
import { Subscribable } from '../abstractions/subscribable';

export class FirstValueFromConverter extends Converter<Subscribable, Promise<any>> {
  private emissionHandler!: ({ emission }: any) => Promise<void>;

  async convert(stream: Subscribable): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let hasEmitted = false;

      try {
        this.emissionHandler = async ({ emission }: any) => {
          if (!hasEmitted) {
            hasEmitted = true;
            stream.onEmission.remove(this, this.emissionHandler);
            resolve(emission.value);
          }
        };

        stream.onEmission.chain(this, this.emissionHandler);

        stream.onStop.once(() => {
          stream.onEmission.remove(this, this.emissionHandler);

          if (!hasEmitted) {
            reject("Subscribable has not emitted any value.");
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }
}

export function firstValueFrom(stream: Subscribable) {
  return new FirstValueFromConverter().convert(stream);
}
