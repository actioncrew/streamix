import { Stream } from '../abstractions';
import { Coroutine } from '../operators';
import { createSubject } from './subject';

export function compute(task: Coroutine, params: any): Stream<any> {
  const subject = createSubject<any>(); // Create a Subject

  // Function to run the task and emit values
  const runTask = async () => {
    let promise = new Promise<void>(async (resolve, reject) => {

      // Get an idle worker for the task
      const worker = await task.getIdleWorker();
      worker.postMessage(params); // Send parameters to the worker

      // Handle messages from the worker
      worker.onmessage = async (event: any) => {
        if (event.data.error) {
          task.returnWorker(worker);
          reject(event.data.error); // Reject if there is an error
        } else {
          subject.next(event.data); // Emit result to subject
          task.returnWorker(worker); // Return the worker
          resolve(); // Resolve the promise
        }
      };

      // Handle errors from the worker
      worker.onerror = async (error: any) => {
        task.returnWorker(worker); // Return the worker
        reject(error); // Reject the promise
      };
    });

    // Wait for completion or error
    try {
      await promise;
    } catch (error) {
      // If an error occurs, propagate the error
      subject.error(error);  // Propagate error through the subject
    } finally {
      subject.complete(); // Complete the subject once the task is done
    }
  };

  runTask(); // Start the task

  subject.name = 'compute';
  return subject; // Return the Subject
}
