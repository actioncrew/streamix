import { from, throwError } from '@actioncrew/streamix';

describe('throwError', () => {
  it('should emit an error with the given message when subscribed', (done) => {
    const stream = from([1, 2, 3]).pipe(throwError('Boom!'));

    stream.subscribe({
      next: () => {
        fail('Expected no values to be emitted');
      },
      error: (err) => {
        expect(err).toEqual(jasmine.any(Error));
        expect(err.message).toBe('Boom!');
        done();
      }
    });
  });

  it('should complete without error if the source is empty', (done) => {
    const stream = from([]).pipe(throwError('Never thrown'));
    let completeCalled = false;

    stream.subscribe({
      next: () => {
        fail('Expected no values to be emitted');
      },
      error: (err) => {
        fail(`Expected no error, but got: ${err}`);
      },
      complete: () => {
        completeCalled = true;
        expect(completeCalled).toBe(true);
        done();
      }
    });
  });
});
