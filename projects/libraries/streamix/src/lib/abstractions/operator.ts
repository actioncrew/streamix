import { Stream } from "./stream";

/**
 * A constant representing a completed stream result.
 *
 * Always `{ done: true, value: undefined }`.
 * Used to signal the end of a stream.
 */
export const DONE: { readonly done: true; readonly value: undefined; } = { done: true, value: undefined } as const;
/**
 * Factory function to create a normal stream result.
 *
 * @template R The type of the emitted value.
 * @param value The value to emit downstream.
 * @returns A `IteratorResult<R>` object with `{ done: false, value }`.
 */
export const NEXT = <R = any>(value: R): { readonly done: false; readonly value: R; } => ({ done: false, value }) as const;

/**
 * A stream operator that transforms a value from an input stream to an output stream.
 *
 * Operators are the fundamental building blocks for composing stream transformations.
 * They are functions that take one stream and return another, allowing for a chain of operations.
 *
 * @template T The type of the value being consumed by the operator.
 * @template R The type of the value being produced by the operator.
 */
export type Operator<T = any, R = T> = {
  /**
   * An optional name for the operator, useful for debugging.
   */
  name?: string;
  /**
   * A type discriminator to identify this object as an operator.
   */
  type: 'operator';
  /**
   * The core function that defines the operator's transformation logic. It takes an
   * asynchronous iterator of type `T` and returns a new asynchronous iterator of type `R`.
   * @param source The source async iterator to apply the transformation to.
   */
  apply: (source: AsyncIterator<T>) => AsyncIterator<R>;
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
  transformFn: (source: AsyncIterator<T>) => AsyncIterator<R>
): Operator<T, R> {
  return {
    name,
    type: 'operator',
    apply: transformFn
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
