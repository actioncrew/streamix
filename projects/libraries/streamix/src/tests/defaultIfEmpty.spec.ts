import { concatMap, createSubject, defaultIfEmpty, EMPTY, of } from '@actioncrew/streamix';

describe('DefaultIfEmptyOperator', () => {
  it('should emit the default value if no values are emitted', (done) => {
    const stream = createSubject();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(defaultIfEmpty(defaultValue));
    const emittedValues: any[] = [];

    processedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([defaultValue]);
        done();
      }
    });

    stream.complete();
  });

  it('should not emit the default value if values are emitted', (done) => {
    const stream = createSubject<string>();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(defaultIfEmpty(defaultValue));
    const emittedValues: any[] = [];

    processedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(['Value 1', 'Value 2']);
        done();
      }
    });

    stream.next('Value 1');
    stream.next('Value 2');
    stream.complete();
  });

  it('should emit default value when one operator returns EMPTY', (done) => {
    const stream = createSubject<string>();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(
      concatMap(() => EMPTY), // This operator simulates an empty stream
      defaultIfEmpty(defaultValue) // This operator provides a default value if the stream is empty
    );

    const emittedValues: any[] = [];

    processedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual([defaultValue]);
        done();
      }
    });

    stream.next('Value 1');

    stream.complete();
  });

  it('should not emit default value if values are emitted before', (done) => {
    const stream = createSubject<string>();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(
      concatMap(() => of('Value 3')), // This operator simulates a new stream
      defaultIfEmpty(defaultValue) // This operator provides a default value if the stream is empty
    );

    const emittedValues: any[] = [];

    processedStream.subscribe({
      next: (value) => emittedValues.push(value),
      complete: () => {
        expect(emittedValues).toEqual(['Value 3', 'Value 3']);
        done();
      }
    });

    stream.next('Value 1');
    stream.next('Value 2');

    stream.complete();
  });
});
