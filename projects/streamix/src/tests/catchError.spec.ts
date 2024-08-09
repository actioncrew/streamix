import { catchError, map, Stream, Subject } from '../lib';

describe('CatchErrorOperator Functional Test', () => {
  let subject: Subject;
  let errorStream: Stream;
  let successfulStream: Stream;
  let handlerMock: jest.Mock;

  beforeEach(() => {
    handlerMock = jest.fn().mockResolvedValue(undefined); // mock handler function
  });

  it('should handle errors from a stream and not propagate them', async () => {
    // Create a subject and attach the catchError operator to it
    subject = new Subject();
    let error = new Error("Unhandled exception.");
    const streamWithCatchError = subject
      .pipe(map(() => { throw error; }), catchError(handlerMock));

    streamWithCatchError.subscribe(value => {
      console.log(value);
    });

    subject.next(1);
    streamWithCatchError.complete();

    Promise.race([streamWithCatchError.awaitCompletion(), streamWithCatchError.awaitTermination()]).then(() => {
      expect(handlerMock).toHaveBeenCalled();
      expect(streamWithCatchError.isStopped()).toBe(true); // Stream should complete
      expect(streamWithCatchError.isFailed()).toBe(false); // Stream should not propagate an error
    });
  });

  it('should propagate errors if catchError is not present', async () => {
    // Create a subject and attach the catchError operator to it
    // Create a subject and attach the catchError operator to it
    subject = new Subject();
    let error = new Error("Unhandled exception.");
    const streamWithCatchError = subject
      .pipe(map(() => { throw error; }));

    streamWithCatchError.subscribe(value => {
      console.log(value);
    });

    subject.next(1);
    streamWithCatchError.complete();

    Promise.race([streamWithCatchError.awaitCompletion(), streamWithCatchError.awaitTermination()]).then(() => {
      expect(handlerMock).not.toHaveBeenCalled();
      expect(streamWithCatchError.isStopped()).toBe(true); // Stream should complete
      expect(streamWithCatchError.isFailed()).toBe(true); // Stream should propagate an error
    });
  });
});
