import { createMapper, Stream, StreamMapper } from "../abstractions";
import { eachValueFrom } from "../converters";
import { createSubject } from "../streams";

export function recurse<T = any>(
  condition: (value: T) => boolean,
  project: (value: T) => Stream<T>
): StreamMapper {
  return createMapper('recurse', (input: Stream<T>) => {
    const output = createSubject<T>();
    let activeCount = 0;
    let inputComplete = false;

    const processItem = async (value: T) => {
      try {
        activeCount++;
        
        // Emit the current value
        output.next(value);
        
        // Check recursion condition
        if (condition(value)) {
          const nextStream = project(value);
          
          // Process next items recursively
          for await (const nextValue of eachValueFrom(nextStream)) {
            await processItem(nextValue);
          }
        }
      } catch (err) {
        output.error(err);
      } finally {
        activeCount--;
        if (inputComplete && activeCount === 0) {
          output.complete();
        }
      }
    };

    (async () => {
      try {
        // Process initial stream
        for await (const value of eachValueFrom(input)) {
          await processItem(value);
        }
      } catch (err) {
        output.error(err);
      } finally {
        inputComplete = true;
        if (activeCount === 0) {
          output.complete();
        }
      }
    })();

    return output;
  });
}
