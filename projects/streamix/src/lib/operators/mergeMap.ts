import { createStreamOperator, Stream, StreamOperator } from '../abstractions';
import { createSubject } from '../streams/subject';

export function mergeMap<T, R>(project: (value: T) => Stream<R>): StreamOperator {
  return createStreamOperator('mergeMap', (input: Stream<T>): Stream<R> => {
    const output = createSubject<R>();

    (async () => {
      try {
        for await (const emission of input) {
          const innerStream = project(emission.value!);

          // Handling the inner stream
          (async () => {
            try {
              for await (const innerEmission of innerStream) {
                output.next(innerEmission.value!);
              }
            } catch (err) {
              output.error(err); // Propagate the error from inner stream
            }
          })();
        }
      } catch (err) {
        output.error(err); // Propagate error from the outer stream if it occurs
      }
    })();

    return output;
  });
}
