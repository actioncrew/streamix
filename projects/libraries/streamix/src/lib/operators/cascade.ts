import { createOperator, createStreamResult, DONE, NEXT, Operator } from "../abstractions";
import { Coroutine } from "./coroutine";

/**
 * A coroutine-like operator that can process tasks asynchronously in the background.
 * Extends the base Operator interface to provide task processing capabilities
 * with proper resource cleanup.
 *
 * This interface combines the properties of a stream `Operator` with the
 * functionality of a standalone coroutine, allowing it to be used for
 * both stream transformations and direct, one-off data processing.
 *
 * @template T The type of the input value.
 * @template R The type of the output value.
 */
export interface CoroutineLike<T = any, R = T> extends Operator<T, R> {
  /**
   * Processes a single piece of data asynchronously.
   * This method allows the coroutine's logic to be called directly, outside of a stream pipeline.
   *
   * @param data The input data to be processed.
   * @returns A Promise that resolves with the processed output.
   */
  processTask: (data: T) => Promise<R>;
  /**
   * Performs any necessary cleanup and finalization logic.
   * This method is called to release resources held by the coroutine.
   *
   * @returns A Promise that resolves when finalization is complete.
   */
  finalize: () => Promise<void>;
}


export function cascade<A, B>(c1: Coroutine<A, B>): CoroutineLike<A, B>;

export function cascade<A, B, C>(
  c1: Coroutine<A, B>,
  c2: Coroutine<B, C>
): CoroutineLike<A, C>;

export function cascade<A, B, C, D>(
  c1: Coroutine<A, B>,
  c2: Coroutine<B, C>,
  c3: Coroutine<C, D>
): CoroutineLike<A, D>;


export function cascade<T = any, R = any>(...tasks: Coroutine<any, any>[]): CoroutineLike<T, R>;

/**
 * Chains multiple coroutine tasks sequentially, creating a single `CoroutineLike` operator.
 *
 * Each coroutine in the sequence processes the output of the previous coroutine,
 * forming a data processing pipeline. This function is useful for composing
 * complex asynchronous operations from simpler, reusable building blocks.
 *
 * The final output type of the cascade is the output type of the last coroutine in the chain.
 *
 * @template T The input type of the first coroutine.
 * @template R The output type of the last coroutine.
 * @param {Coroutine<any, any>[]} tasks An array of coroutines to chain.
 * @returns {CoroutineLike<T, R>} A `CoroutineLike` operator representing the entire cascaded pipeline.
 */
export function cascade<T = any, R = any>(
  ...tasks: Coroutine<any, any>[]
): CoroutineLike<T, R> {
  const operator = createOperator<T, R>("cascade", function (this: Operator, source) {
    let completed = false;

    return {
      async next() {
        while (true) {
          if (completed) {
            return DONE;
          }

          const result = createStreamResult(await source.next());
          if (result.done) {
            completed = true;
            return DONE;
          }

          let taskResult: any = result.value;
          for (const task of tasks) {
            taskResult = await task.processTask(taskResult);
          }

          return NEXT(taskResult);
        }
      },
      async return() {
        completed = true;
        return DONE;
      },
      async throw(err) {
        completed = true;
        throw err;
      }
    };
  }) as Operator<T, R>;

  const coroutineLike: CoroutineLike<T, R> = Object.assign(operator, {
    async processTask(data: T) {
      let result: any = data;
      for (const task of tasks) {
        result = await task.processTask(result);
      }
      return result as R;
    },
    async finalize() {
      for (const task of tasks) {
        await task.finalize();
      }
    }
  });

  return coroutineLike;
}
