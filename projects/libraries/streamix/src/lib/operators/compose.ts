import { createOperator } from "../abstractions";
import { Coroutine } from "./coroutine";

/**
 * Compose operator that chains multiple coroutine tasks sequentially.
 * Each task processes the output of the previous task.
 */
export const compose = <T = any, R = T>(...tasks: Coroutine<any, any>[]) => {
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
