import { catchError, createSubject, map, Subject } from '../lib';

describe('CatchErrorOperator Functional Test', () => {
  let subject: Subject;
  let handlerMock: jest.Mock;

  beforeEach(() => {
    handlerMock = jest.fn().mockResolvedValue(undefined); // mock handler function
  });

  it('should handle errors from a stream and not propagate them', (done) => {
    // Create a subject and attach the catchError operator to it
    subject = createSubject();
    let error = new Error("Unhandled exception.");
    const streamWithCatchError = subject
      .pipe(map(() => { throw error; }), catchError(handlerMock));

    streamWithCatchError.subscribe({
      next: value => console.log(value),
      complete: () => { expect(handlerMock).toHaveBeenCalled(); done(); }
    });

    subject.next(1);
    subject.complete();
  });

  it('should propagate errors if catchError is not present', (done) => {
    // Create a subject and attach the catchError operator to it
    // Create a subject and attach the catchError operator to it
    subject = createSubject();
    let error = new Error("Unhandled exception.");
    const streamWithCatchError = subject
      .pipe(map(() => { throw error; }));

    streamWithCatchError.subscribe({
      next: value => console.log(value),
      complete: () => { expect(handlerMock).not.toHaveBeenCalled(); done(); }
    });

    subject.next(1);
    subject.complete();
  });
});
