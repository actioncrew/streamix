import { Emission } from '../abstractions/emission';
import { AbstractOperator } from '../abstractions/operator';
import { AbstractStream } from '../abstractions/stream';
import { Subscription } from '../abstractions/subscription';

export class SwitchMapOperator extends AbstractOperator {
  private readonly project: (value: any) => AbstractStream;
  private currentSubscription?: Subscription;

  constructor(project: (value: any) => AbstractStream) {
    super();
    this.project = project;
  }

  async handle(emission: Emission, stream: AbstractStream): Promise<Emission> {
    if (stream.isCancelled.value) {
      emission.isCancelled = true;
      return emission;
    }

    const newSource = this.project(emission.value!);

    // Clean up previous subscription before switching to the new source
    if (this.currentSubscription) {
      this.currentSubscription.unsubscribe();
      this.currentSubscription = undefined;
    }

    return new Promise<Emission>((resolve, reject) => {
      this.currentSubscription = newSource.subscribe((value: any) => {
        resolve({ value });
      });

      // Handle error case
      this.currentSubscription.unsubscribe = () => {
        reject(new Error('Subscription cancelled'));
      };
    });
  }
}

export function switchMap(project: (value: any) => AbstractStream) {
  return new SwitchMapOperator(project);
}
