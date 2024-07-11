import { Emission } from './emission';
import { AbstractStream } from './stream';

export abstract class AbstractOperator {
  next?: AbstractOperator;

  abstract handle(emission: Emission, stream: AbstractStream): Promise<Emission | AbstractStream>;

  async process(emission: Emission, stream: AbstractStream): Promise<Emission> {
    const request = await this.handle(emission, stream);

    if (request instanceof AbstractStream) {
      return new Promise<Emission>((resolve, reject) => {
        const newEmission = { value: undefined } as Emission;
        let isResolved = false;

        const subscription = request.subscribe((value) => {
          newEmission.value = value;
          if (this.next) {
            this.next.process(newEmission, stream)
              .then(resolve)
              .catch(reject)
              .finally(() => {
                if (!isResolved) {
                  isResolved = true;
                  subscription.unsubscribe();
                }
              });
          } else {
            resolve(newEmission);
            isResolved = true;
            subscription.unsubscribe();
          }
        });

        request.isCancelled.promise.then(() => {
          if (!isResolved) {
            newEmission.isCancelled = true;
            resolve(newEmission);
            isResolved = true;
            subscription.unsubscribe();
          }
        });

        request.isStopped.promise.then(() => {
          if (!isResolved) {
            newEmission.isPhantom = true;
            resolve({ isPhantom: true });
            isResolved = true;
            subscription.unsubscribe();
          }
        });
      });
    } else if (this.next) {
      return this.next.process(request, stream);
    } else {
      return request;
    }
  }
}
