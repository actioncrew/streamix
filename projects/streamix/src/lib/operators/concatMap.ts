import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';

export class ConcatMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private active: boolean = false;
  private queue: any[] = [];

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  async handle(request: Emission, cancellationToken?: boolean): Promise<Emission> {
    if (cancellationToken) {
      return Promise.resolve({ ...request, isCancelled: true });
    }

    this.queue.push(request.value);

    if (this.active) {
      return Promise.resolve(request);
    }

    this.active = true;

    while (this.queue.length > 0) {
      const value = this.queue.shift();
      const innerStream = this.project(value);

      await new Promise((resolve, reject) => {
        innerStream.subscribe(async (innerValue: any) => {
          try {
            await this.next?.handle({ value: innerValue, isCancelled: false, isPhantom: false, error: undefined }, cancellationToken);
          } catch (error) {
            reject(error);
          }
        });

        innerStream.run().then(resolve).catch(reject);
      });
    }

    this.active = false;

    return Promise.resolve(request);
  }
}

export function concatMap(project: (value: any) => AbstractStream) {
  return new ConcatMapOperator(project);
}
