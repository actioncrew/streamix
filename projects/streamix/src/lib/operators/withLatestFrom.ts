import { AbstractOperator, AbstractStream, Emission, Subscription } from '../abstractions';
import { PromisifiedValue } from '../utils/value';

export class WithLatestFromOperator extends AbstractOperator {
  private latestValues: PromisifiedValue<any>[] = [];
  private subscriptions: Subscription[] = [];
  private streams: AbstractStream[];

  constructor(...streams: AbstractStream[]) {
    super();
    this.streams = streams;
    this.streams.forEach((stream) => {
      const latestValue = new PromisifiedValue();
      this.latestValues.push(latestValue);
      this.subscriptions.push(stream.subscribe((value) => {
        latestValue.value = value;
      }));
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    try {
      const latestValuesPromise = Promise.all(this.latestValues.map(async (value) => await value.value));
      const terminationPromise = stream.awaitTermination();

      const [latestValues, isTerminated] = await Promise.race([
        latestValuesPromise.then(values => [values, false] as any),
        terminationPromise.then(() => [undefined, true] as any)
      ]);

      if (!isTerminated) {
        emission.value = [emission.value, ...latestValues];
      }
    } catch (error) {
      emission.error = error;
      emission.isFailed = true;
    }

    return emission;
  }
}

export function withLatestFrom(...streams: AbstractStream[]) {
  return new WithLatestFromOperator(...streams);
}
