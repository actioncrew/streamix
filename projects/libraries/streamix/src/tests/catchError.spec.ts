import { catchError, createSubject, map, Subject } from '@actioncrew/streamix';

describe('CatchErrorOperator Functional Test', () => {
  let subject: Subject;
  let handlerMock: jasmine.Spy;

  beforeEach(() => {
    handlerMock = jasmine.createSpy('handlerMock').and.returnValue(Promise.resolve(undefined)); // Mock handler function
  });

  it('should handle errors from a stream and not propagate them', (done) => {
    subject = createSubject();
    const error = new Error("Unhandled exception.");

    const streamWithCatchError = subject
      .pipe(
        map(() => { throw error; }),
        catchError(handlerMock)
      );

    streamWithCatchError.subscribe({
      next: value => console.log(value),
      complete: () => {
        expect(handlerMock).toHaveBeenCalled();
        done();
      }
    });

    subject.next(1);
    subject.complete();
  });

  it('should propagate errors if catchError is not present', (done) => {
    subject = createSubject();
    const error = new Error("Unhandled exception.");

    const streamWithoutCatchError = subject.pipe(map(() => { throw error; }));

    streamWithoutCatchError.subscribe({
      next: value => console.log(value),
      error: (err) => {
        expect(err).toBe(error);
        expect(handlerMock).not.toHaveBeenCalled();
        done();
      }
    });

    subject.next(1);
    subject.complete();
  });
});
