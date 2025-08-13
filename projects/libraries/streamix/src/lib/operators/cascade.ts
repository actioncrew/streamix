import { createOperator, Operator } from "../abstractions";
import { Coroutine } from "./coroutine";

/**
 * A coroutine-like operator that can process tasks asynchronously in the background.
 * Extends the base Operator interface to provide task processing capabilities
 * with proper resource cleanup.
 */
export interface CoroutineLike<T = any, R = T> extends Operator<T, R> {
  processTask: (data: T) => Promise<R>;
  finalize: () => Promise<void>;
}

/**
 * Cascade operator that chains multiple coroutine tasks sequentially.
 * Each task processes the output of the previous task.
 */
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

export function cascade<T = any, R = any>(
  ...tasks: Coroutine<any, any>[]
): CoroutineLike<T, R> {
  const operator = createOperator<T, R>("cascade", (source) => ({
    async next() {
      const { done, value } = await source.next();
      if (done) return { done: true, value: undefined };

      let result: any = value;
      for (const task of tasks) {
        result = await task.processTask(result);
      }

      return { done: false, value: result as R };
    },
    async return() {
      return { done: true, value: undefined };
    },
    async throw(err) {
      throw err;
    }
  })) as Operator<T, R>;

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
