import { createStreamResult, StreamContext, StreamResult } from "./context";
import { Stream, StreamIterator } from "./stream";

/**
 * A constant representing a completed stream result.
 *
 * Always `{ done: true, value: undefined }`.
 * Used to signal the end of a stream.
 */
export const DONE = createStreamResult({ done: true, value: undefined });
/**
 * Factory function to create a normal stream result.
 *
 * @template R The type of the emitted value.
 * @param value The value to emit downstream.
 * @returns A `StreamResult<R>` object with `{ done: false, value }`.
 */
export const NEXT = <R = any>(value: R) => createStreamResult<R>({ done: false, value });

/**
 * Represents a stream operator that transforms values from an input stream into an output stream.
 *
 * Operators are the fundamental building blocks for composing stream transformations.
 * They consume values from an input `StreamIterator<T>` and produce transformed values
 * through a new `StreamIterator<R>`. Operators can be chained together using `pipe`.
 *
 * @template T The type of values consumed by the operator (input).
 * @template R The type of values produced by the operator (output).
 */
export type Operator<T = any, R = T> = {
  /**
   * An optional human-readable name for the operator, useful for debugging or logging.
   */
  name?: string;

  /**
   * A type discriminator identifying this object as an operator.
   */
  type: "operator";

  /**
   * The core transformation function of the operator.
   *
   * @param source The source async stream iterator providing values of type `T`.
   * @param context Stream-specific context for logging, phantom handling, and lifecycle.
   * @returns A new async stream iterator that yields values of type `R`.
   */
  apply: (source: StreamIterator<T>, context?: StreamContext) => StreamIterator<R>;
};

/**
 * Creates a reusable stream operator.
 *
 * This factory function simplifies the creation of operators by bundling a name and a
 * transformation function into a single `Operator` object.
 *
 * @template T The type of the value the operator will consume.
 * @template R The type of the value the operator will produce.
 * @param name The name of the operator, for identification and debugging.
 * @param transformFn The transformation function that defines the operator's logic.
 * @returns A new `Operator` object with the specified name and transformation function.
 */
export function createOperator<T = any, R = T>(
  name: string,
  transformFn: (source: StreamIterator<T>, context?: StreamContext) => StreamIterator<R>
): Operator<T, R> {
  return {
    name,
    type: 'operator',
    apply: transformFn,
  };
}

/**
 * A type representing a chain of stream operators.
 *
 * This type uses function overloading to provide strong type safety for a sequence
 * of operators. Each overload correctly infers the final stream's type by tracking the
 * output of one operator as the input of the next.
 *
 * @template T The initial type of the stream.
 * @internal This interface is primarily for internal type-checking and should not be
 * used directly by consumers.
 */
export interface OperatorChain<T> {
  // Base case (0 operators)
  (): Stream<T>;

  // 1-16 operators with proper type propagation
  <A>(op1: Operator<T, A>): Stream<A>;
  <A, B>(op1: Operator<T, A>, op2: Operator<A, B>): Stream<B>;
  <A, B, C>(op1: Operator<T, A>, op2: Operator<A, B>, op3: Operator<B, C>): Stream<C>;
  <A, B, C, D>(op1: Operator<T, A>, op2: Operator<A, B>, op3: Operator<B, C>, op4: Operator<C, D>): Stream<D>;
  <A, B, C, D, E>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>
  ): Stream<E>;
  <A, B, C, D, E, F>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>
  ): Stream<F>;
  <A, B, C, D, E, F, G>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>
  ): Stream<G>;
  <A, B, C, D, E, F, G, H>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>
  ): Stream<H>;
  <A, B, C, D, E, F, G, H, I>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>
  ): Stream<I>;
  <A, B, C, D, E, F, G, H, I, J>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>,
    op10: Operator<I, J>
  ): Stream<J>;
  <A, B, C, D, E, F, G, H, I, J, K>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>,
    op10: Operator<I, J>,
    op11: Operator<J, K>
  ): Stream<K>;
  <A, B, C, D, E, F, G, H, I, J, K, L>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>,
    op10: Operator<I, J>,
    op11: Operator<J, K>,
    op12: Operator<K, L>
  ): Stream<L>;
  <A, B, C, D, E, F, G, H, I, J, K, L, M>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>,
    op10: Operator<I, J>,
    op11: Operator<J, K>,
    op12: Operator<K, L>,
    op13: Operator<L, M>
  ): Stream<M>;
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>,
    op10: Operator<I, J>,
    op11: Operator<J, K>,
    op12: Operator<K, L>,
    op13: Operator<L, M>,
    op14: Operator<M, N>
  ): Stream<N>;
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>,
    op10: Operator<I, J>,
    op11: Operator<J, K>,
    op12: Operator<K, L>,
    op13: Operator<L, M>,
    op14: Operator<M, N>,
    op15: Operator<N, O>
  ): Stream<O>;
  <A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P>(
    op1: Operator<T, A>,
    op2: Operator<A, B>,
    op3: Operator<B, C>,
    op4: Operator<C, D>,
    op5: Operator<D, E>,
    op6: Operator<E, F>,
    op7: Operator<F, G>,
    op8: Operator<G, H>,
    op9: Operator<H, I>,
    op10: Operator<I, J>,
    op11: Operator<J, K>,
    op12: Operator<K, L>,
    op13: Operator<L, M>,
    op14: Operator<M, N>,
    op15: Operator<N, O>,
    op16: Operator<O, P>
  ): Stream<P>;

  (...operators: Operator<any, any>[]): Stream<any>;
};

/**
 * Patches a stream operator to add observability and pipeline context management.
 * * This higher-order function wraps an existing `Operator` to automatically handle
 * the `PipeContext` lifecycle, such as pushing and popping the operator's name
 * onto the `operatorStack` for each value processed. This provides a transparent
 * way to track the flow of data through a stream pipeline for debugging and
 * tracing purposes without each operator needing to manage the context manually.
 * * The patched operator's `apply` method intercepts the stream and returns a new
 * iterator that decorates the original one. The `next()` method of this new iterator
 * pushes the operator's name to the stack before the original operation and pops it
 * off after the value is processed, ensuring the stack accurately represents the
 * current position in the pipeline.
 *
 * @template TIn The type of the values in the input stream.
 * @template TOut The type of the values in the output stream.
 * @param operator The original `Operator` to be patched.
 * @returns A new `Operator` instance with patched behavior for context management.
 */
export function patchOperator<TIn, TOut>(
  operator: Operator<TIn, TOut>
): Operator<TIn, TOut> {
  const originalApply = operator.apply;

  return {
    name: operator.name,
    type: operator.type,
    apply: (source: StreamIterator<TIn>, context?: StreamContext) => {
      const originalIterator = originalApply.call(operator, source, context);
      context?.pipeline.operators.push(operator);

      return {
        async next(): Promise<StreamResult> {

          const result = await originalIterator.next.apply(originalIterator);
          return createStreamResult({
            ...result,
          });
        },

        return: async (): Promise<StreamResult> => {
          if (originalIterator.return) {
            const res = await originalIterator.return();
            return createStreamResult({ ...res });
          }
          return createStreamResult({ done: true, value: undefined });
        },

        throw: async (err?: any): Promise<StreamResult> => {
          if (originalIterator.throw) {
            const res = await originalIterator.throw(err);
            return createStreamResult({ ...res });
          }
          return createStreamResult({ done: true, value: undefined, error: err });
        },
      };
    },
  };
}
