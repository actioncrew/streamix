import { createSubject, Subject } from './subject';

// Function to create a FromPromiseStream using Subject
export function fromPromise<T = any>(promise: Promise<T>): Subject<T> {
  // Create a new Subject to handle emissions
  const subject = createSubject<T>();

  // Handle the promise resolution
  promise
    .then((resolvedValue) => {
      subject.next(resolvedValue);
    })
    .catch((error) => {
      subject.error(error); // Handle promise rejection by passing the error
    }).finally(() => subject.complete());

  return subject;
}
