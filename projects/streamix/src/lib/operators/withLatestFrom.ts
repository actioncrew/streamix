import { Emission, Operator, Subscribable, Subscription } from '../abstractions';
import { asyncValue } from '../utils';

export class WithLatestFromOperator extends Operator {
  private latestValues: ReturnType<typeof asyncValue<any>>[] = [];
  private subscriptions: Subscription[] = [];
  private streams: Subscribable[];

  constructor(...streams: Subscribable[]) {
    super();
    this.streams = streams;
    this.streams.forEach((stream) => {
      const latestValue = asyncValue();
      this.latestValues.push(latestValue);
      this.subscriptions.push(stream.subscribe((value) => {
        latestValue.set(value);
      }));
    });
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {
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

export const withLatestFrom = (...streams: Subscribable[]) => new WithLatestFromOperator(...streams);
