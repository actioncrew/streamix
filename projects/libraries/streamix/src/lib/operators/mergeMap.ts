import { eachValueFrom } from '@actioncrew/streamix';
import { createOperator, Stream } from "../abstractions";

export const mergeMap = <T, R>(
  project: (value: T, index: number) => Stream<R>
) =>
  createOperator("mergeMap", (source) => {
    let outerDone = false;
    let outerIndex = 0;
    const innerIterators = new Set<AsyncIterator<R>>();
    let error: any = null;

    // Helper to pull from inner iterators concurrently
    async function pullInner() {
      while (innerIterators.size > 0) {
        try {
          // Race next() calls from all inner iterators
          const promises = Array.from(innerIterators).map(async (it) => ({
            it,
            res: await it.next(),
          }));

          const { it, res } = await Promise.race(promises);

          if (res.done) {
            innerIterators.delete(it);
          } else {
            return res.value;
          }
        } catch (err) {
          error = err;
          innerIterators.clear();
          throw err;
        }
      }
      return undefined;
    }

    return {
      async next() {
        // If error was caught before, rethrow it
        if (error) throw error;

        // Try to pull next value from inner iterators if any
        if (innerIterators.size > 0) {
          const val = await pullInner();
          if (val !== undefined) {
            return { done: false, value: val };
          }
        }

        // If no inner streams active, pull from outer source
        if (outerDone) {
          return { done: true, value: undefined };
        }

        const outerResult = await source.next();
        if (outerResult.done) {
          outerDone = true;
          // If no active inner streams, complete
          if (innerIterators.size === 0) {
            return { done: true, value: undefined };
          }
          // Otherwise, continue pulling from inner iterators
          return this.next();
        }

        // Create new inner iterator and add to the set
        const innerIter = eachValueFrom(project(outerResult.value, outerIndex++));
        innerIterators.add(innerIter);

        // Pull from inner iterators again after adding new one
        return this.next();
      },

      async return() {
        innerIterators.clear();
        outerDone = true;
        if (source.return) await source.return();
        return { done: true, value: undefined };
      },

      async throw(e: any) {
        innerIterators.clear();
        outerDone = true;
        if (source.throw) await source.throw(e);
        throw e;
      },
    };
  });
