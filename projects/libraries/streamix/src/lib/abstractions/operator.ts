import { Stream } from "./stream";

/**
 * Defines a stream operator that transforms an async iterator of type T into another of type R.
 * Operators are composable units used to manipulate or filter stream values.
 */
export type Operator<T = any, R = T> = {
  name?: string;
  type: 'operator';
  apply: (source: AsyncIterator<T>) => AsyncIterator<R>;
};

/**
 * Creates a reusable stream operator with a given name and transformation logic.
 * The operator can be applied to any compatible async iterator to produce transformed output.
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
