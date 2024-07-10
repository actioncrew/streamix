import { Emission } from './emission';
import { AbstractStream } from './stream';

export abstract class AbstractOperator {
  next?: AbstractOperator;

  abstract handle(emission: Emission, stream: AbstractStream): Promise<Emission | AbstractStream>;

  async process(emission: Emission, stream: AbstractStream): Promise<Emission> {
    const result = await this.handle(emission, stream);

    if (result instanceof AbstractStream) {
      return new Promise<Emission>((resolve) => {
        result.subscribe((value) => {
          const newEmission = { value } as Emission;
          if (this.next) {
            this.next.process(newEmission, stream).then(resolve);
          } else {
            resolve(newEmission);
          }
        });

        result.isStopped.promise.then(() => {
          resolve({ isPhantom: true });
        })
      });
    } else if (this.next) {
      return this.next.process(result, stream);
    } else {
      return result;
    }
  }
}
