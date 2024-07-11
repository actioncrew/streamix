import { AbstractOperator, AbstractStream, Emission } from '../abstractions';

export class MergeMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  async handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      request.isCancelled = true;
      return request;
    }

    const innerStream = this.project(request.value!);

    return new Promise<Emission>((resolve, reject) => {
      const subscription = innerStream.subscribe(
        (value) => {
          const newEmission = { value };
          this.next?.process(newEmission, stream).catch(reject);
        });

      innerStream.isFailed.promise.then((error) => {
        request.error = error;
        request.isFailed = true;
        subscription.unsubscribe();
        reject(error);
      })

      innerStream.isStopped.promise.then(() => {
        request.isPhantom = true;
        resolve(request);
      }); // Complete the outer promise when inner stream completes
    });
  }
}

export function mergeMap(project: (value: any) => AbstractStream) {
  return new MergeMapOperator(project);
}
