import { Converter } from '../abstractions/converter';
import { Subscribable } from '../abstractions/subscribable';

export class LastValueFromConverter extends Converter<Subscribable, Promise<any>> {
  private emissionHandler!: ({ emission }: any) => Promise<void>;

  async convert(stream: Subscribable): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let hasEmitted = false;
      let lastValue: any;

      try {
        this.emissionHandler = async ({ emission }: any) => {
          lastValue = emission.value;
          hasEmitted = true;
        };

        stream.onEmission.chain(this, this.emissionHandler);

        stream.onStop.once(() => {
          stream.onEmission.remove(this, this.emissionHandler);
          if (hasEmitted) {
            resolve(lastValue!);
          } else {
            reject("Subscribable has not emitted any value.");
          }
        }); // Handle any errors
      } catch (error) {
        reject(error);
      }
    });
  }
}

export function lastValueFrom(stream: Subscribable) {
  return new LastValueFromConverter().convert(stream);
}
