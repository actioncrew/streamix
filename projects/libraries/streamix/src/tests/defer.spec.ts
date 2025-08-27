import { createSubject, defer, Stream } from '@actioncrew/streamix';

// Mocking Stream class
export function mockStream(values: any[], completed = false, error?: Error): Stream<any> {
  const subject = createSubject<any>();

  setTimeout(() => {
    if (error) {
      subject.error(error);
      return;
    }

    values.forEach(value => subject.next(value));

    if (completed) {
      subject.complete();
    }
  }, 0);

  return subject;
}

describe('DeferStream', () => {
  it('should create a new stream each time it is subscribed to', (done) => {
    const emissions: any[] = [1, 2, 3];
    const factory = jasmine.createSpy('factory').and.callFake(() => mockStream(emissions, true));

    const deferStream = defer(factory);

    const collectedEmissions: number[] = [];
    const subscription = deferStream.subscribe({
      next: (value: any) => collectedEmissions.push(value),
      complete: () => {
        expect(factory).toHaveBeenCalled();
        expect(collectedEmissions.length).toBe(3);
        expect(collectedEmissions).toEqual([1, 2, 3]);

        subscription.unsubscribe();
        done();
      },
      error: done.fail,
    });
  });

  it('should handle stream completion', (done) => {
    const factory = jasmine.createSpy('factory').and.callFake(() => mockStream([], true));

    const deferStream = defer(factory);

    deferStream.subscribe({
      complete: () => {
        expect(factory).toHaveBeenCalled();
        done();
      },
      error: done.fail,
    });
  });

  it('should handle stream errors', (done) => {
    const error = new Error('Test Error');
    const factory = jasmine.createSpy('factory').and.callFake(() => mockStream([], false, error));

    const deferStream = defer(factory);

    deferStream.subscribe({
      error: (e: Error) => {
        expect(e).toEqual(error);
      },
      complete: () => {
        done();
      },
      next: () => {
        fail('Should not emit');
      }
    });
  });
});
