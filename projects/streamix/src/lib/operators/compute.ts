import { Subscribable } from '../abstractions';
import { Emission } from '../abstractions/emission';
import { Operator } from '../abstractions/operator';

export class ComputeOperator extends Operator {
  private worker: Worker;

  constructor(functions: Function[]) {
    super();

    if (functions.length === 0) {
      throw new Error("At least one function (the main task) is required.");
    }

    const [mainTask, ...dependencies] = functions;

    const injectedDependencies = dependencies.map(fn => {
      let fnBody = fn.toString();
      fnBody = fnBody.replace(/function[\s]*\(/, `function ${fn.name}(`);
      return fnBody;
    }).join(';');

    const mainTaskBody = mainTask.toString().replace(/function[\s]*\(/, `function ${mainTask.name}(`);

    const workerBody = `
      ${injectedDependencies}
      const mainTask = ${mainTaskBody};
      onmessage = (event) => {
        const result = mainTask(event.data);
        postMessage(result);
      };
    `;

    const blob = new Blob([workerBody], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  async handle(emission: Emission, stream: Subscribable): Promise<Emission> {

    return new Promise((resolve, reject) => {
      this.worker.postMessage(emission.value);
      this.worker.onmessage = (event) => {
        emission.value = event.data;
        resolve(emission);
      };
      this.worker.onerror = (error) => {
        reject(error);
      };
    });
  }
}

export const compute = (...functions: Function[]) => new ComputeOperator(functions);
