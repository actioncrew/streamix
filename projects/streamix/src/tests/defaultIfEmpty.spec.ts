import { concatMap, createSubject, defaultIfEmpty, EMPTY, of, Subject } from '../lib';

describe('DefaultIfEmptyOperator', () => {
  test('should emit the default value if no values are emitted', (done) => {
    const stream = createSubject();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(defaultIfEmpty(defaultValue));
    const emittedValues: any[] = [];

    processedStream.subscribe((value) => {
      emittedValues.push(value);
    });

    processedStream.onStop.once(() => {
      expect(emittedValues).toEqual([defaultValue]);
      done();
    });

    processedStream.complete();
  });

  test('should not emit the default value if values are emitted', (done) => {
    const stream = createSubject<string>();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(defaultIfEmpty(defaultValue));
    const emittedValues: any[] = [];

    processedStream.subscribe((value) => {
      emittedValues.push(value);
    });

    stream.next('Value 1');
    stream.next('Value 2');
    processedStream.complete();

    processedStream.onStop.once(() => {
      expect(emittedValues).toEqual(['Value 1', 'Value 2']);
      done();
    });
  });

  test('should emit default value when one operator returns EMPTY', (done) => {
    const stream = createSubject<string>();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(
      concatMap(() => EMPTY), // This operator simulates an empty stream
      defaultIfEmpty(defaultValue) // This operator provides a default value if the stream is empty
    );

    const emittedValues: any[] = [];

    processedStream.subscribe((value) => {
      emittedValues.push(value);
    });

    stream.next('value 1');
    processedStream.complete();

    processedStream.onStop.once(() => {
      expect(emittedValues).toEqual([defaultValue]);
      done();
    });
  });

  test('should not emit default value if values are emitted before', (done) => {
    const stream = createSubject<string>();
    const defaultValue = 'Default Value';
    const processedStream = stream.pipe(
      concatMap(() => of('Value 3')), // This operator simulates a new stream
      defaultIfEmpty(defaultValue) // This operator provides a default value if the stream is empty
    );

    const emittedValues: any[] = [];

    processedStream.subscribe((value) => {
      emittedValues.push(value);
    });

    (processedStream as any).stream.next('Value 1');
    (processedStream as any).stream.next('Value 2');

    processedStream.onStop.once(() => {
      expect(emittedValues).toEqual(['Value 3', 'Value 3']);
      done();
    })

    processedStream.complete();

  });
});
