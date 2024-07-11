import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class MergeMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  handle(request: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    const innerStream = this.project(request.value!);
    return new Promise((resolve, reject) => {
      innerStream.subscribe(async (innerValue: any) => {
        try {
          await this.next?.process({ value: innerValue, isCancelled: false, isPhantom: false, error: undefined }, stream);
        } catch (error) {
          reject(error);
        }
      });

      resolve(request);
    });
  }
}

export function mergeMap(project: (value: any) => AbstractStream) {
  return new MergeMapOperator(project);
}
