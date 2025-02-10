import { createStreamOperator, Operator, Stream, StreamOperator } from "../abstractions";
import { createSubject, from } from "../streams";

export function splitMap<T>(paths: { [key: string]: Array<Operator | StreamOperator> }): StreamOperator {
  const operator = (input: Stream<T>): Stream<any> => {
    const output = createSubject<any>();
    let isOuterComplete = false;
    const partitionQueue: Array<[string, any[]]> = []; // Ordered queue

    const processPartitions = async () => {
      while (partitionQueue.length > 0) {
        const [key, values] = partitionQueue.shift()!;
        const caseOperators = paths[key];

        if (caseOperators) {
          const innerStream = from(values).pipe(...caseOperators);

          try {
            for await (const emission of innerStream) {
              output.next(emission.value!);
            }
          } catch (err) {
            output.error(err);
            return; // Stop processing on error
          }
        } else {
          console.warn(`No operators found for partition key: ${key}`);
        }
      }

      if (isOuterComplete) {
        output.complete(); // Only complete when everything is processed
      }
    };

    (async () => {
      try {
        for await (const emission of input) {
          const partitionMap = emission.value! as any as Map<string, any[]>;

          partitionMap.forEach((values, key) => {
            partitionQueue.push([key, values]);
          });

          if (partitionQueue.length === partitionMap.size) {
            await processPartitions(); // Ensure sequential execution
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        isOuterComplete = true;
        if (partitionQueue.length === 0) {
          output.complete();
        }
      }
    })();

    return output;
  };

  return createStreamOperator('splitMap', operator);
}
