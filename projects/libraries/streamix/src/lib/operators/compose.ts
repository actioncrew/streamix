import { createOperator, Operator } from "../abstractions";
import { Coroutine } from "./coroutine";

/**
 * Compose operator that chains multiple coroutine tasks sequentially.
 * Each task processes the output of the previous task.
 */
export function compose<T = any, R = any>(...tasks: Coroutine<any, any>[]): Operator<T, R>;

export function compose<A, B>(c1: Coroutine<A, B>): Operator<A, B>;

export function compose<A, B, C>(
  c1: Coroutine<A, B>,
  c2: Coroutine<B, C>
): Operator<A, C>;

export function compose<A, B, C, D>(
  c1: Coroutine<A, B>,
  c2: Coroutine<B, C>,
  c3: Coroutine<C, D>
): Operator<A, D>;

export function compose<T = any, R = any>(...tasks: Coroutine<any, any>[]): Operator<T, R> {
  return createOperator<T, R>("pipeline", (source) => ({
    async next() {
      const { done, value } = await source.next();
      if (done) return { done: true, value: undefined };

      let result = value;
      for (const task of tasks) {
        result = await task.processTask(result);
      }

      return { done: false, value: result as unknown as R };
    },
    async return() {
      return { done: true, value: undefined };
    },
    async throw(err) {
      throw err;
    }
  }));
};
