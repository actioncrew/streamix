import { filter, from } from '../lib';

describe('FilterOperator', () => {
  it('should allow values that pass the predicate', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const predicate = (value: number) => value % 2 === 0; // Allow only even numbers

    const filteredStream = testStream.pipe(filter(predicate));

    let didEmit = false;

    filteredStream.subscribe({
      next: (value) => {
        didEmit = true;
        expect(value).toBeGreaterThanOrEqual(2); // Only even numbers should be emitted
      },
      complete: () => {
        if (!didEmit) {
          done(new Error('No values emitted'));
        } else {
          done();
        }
      }
    });
  });

  it('should not emit values that fail the predicate', (done) => {
    const testStream = from([1, 2, 3]);
    const predicate = (value: number) => value > 3; // Allow only values greater than 3

    const filteredStream = testStream.pipe(filter(predicate));

    let didEmit = false;

    filteredStream.subscribe({
      next: () => {
        didEmit = true;
        done(new Error('Unexpected value emitted'));
      },
      complete: () => {
        if (didEmit) {
          done(new Error('Should not emit if no values pass the predicate'));
        } else {
          done();
        }
      }
    });
  });

  it('should emit all allowed values before stopping', (done) => {
    const testStream = from([1, 2, 3, 4, 5]);
    const predicate = (value: number) => value <= 3; // Allow values less than or equal to 3

    let count = 0;

    const filteredStream = testStream.pipe(filter(predicate));

    filteredStream.subscribe({
      next: () => count++,
      complete: () => {
        if (count === 3) {
          done();
        } else {
          done(new Error('Did not emit all allowed values or stopped prematurely'));
        }
      }
    });
  });
});
