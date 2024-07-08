import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class MergeMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  handle(request: Emission, cancellationToken?: boolean): Promise<Emission> {
    if (cancellationToken) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    const innerStream = this.project(request.value!);
    return new Promise((resolve, reject) => {
      innerStream.subscribe(async (innerValue: any) => {
        try {
          await this.next?.handle({ value: innerValue, isCancelled: false, isPhantom: false, error: undefined }, cancellationToken);
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
