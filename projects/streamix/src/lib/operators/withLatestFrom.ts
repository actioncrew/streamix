import { AbstractOperator, AbstractStream, Emission, Subscription } from '../abstractions';
import { promisifiedValue } from '../utils';

export class WithLatestFromOperator extends AbstractOperator {
  private latestValues: ReturnType<typeof promisifiedValue<any>>[] = [];
  private subscriptions: Subscription[] = [];
  private streams: AbstractStream[];

  constructor(...streams: AbstractStream[]) {
    super();
    this.streams = streams;
    this.streams.forEach((stream) => {
      const latestValue = promisifiedValue();
      this.latestValues.push(latestValue);
      this.subscriptions.push(stream.subscribe((value) => {
        latestValue.set(value);
      }));
    });
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    const latestValuesPromise = Promise.all(this.latestValues.map(async (value) => await value()));
    const terminationPromise = stream.awaitTermination();
    const terminationPromises = Promise.race(this.streams.map(stream => stream.awaitTermination()))

    let [latestValues, isTerminated, areTerminated] = [[] as any[], false, false];
    await Promise.race([
      latestValuesPromise.then(values => latestValues = values),
      terminationPromise.then(() => isTerminated = true),
      terminationPromises.then(() => areTerminated = true)
    ]);

    if (!isTerminated && !areTerminated) {
      emission.value = [emission.value, ...latestValues];
    } else {
      emission.isCancelled = true;
    }

    return emission;
  }
}

export const withLatestFrom = (...streams: AbstractStream[]) => new WithLatestFromOperator(...streams);
