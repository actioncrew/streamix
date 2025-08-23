import { CallbackReturnType } from "./receiver";
import { StreamResult } from "./stream";

/**
 * Context object provided to operators during stream piping.
 *
 * `PipeContext` carries metadata and utility functions that help operators
 * coordinate within a pipeline, such as tracking the operator stack and
 * handling phantom (filtered or suppressed) values.
 */
export interface PipeContext {
  /**
   * A list of stream results that are currently in-flight and
   * have not yet been fully resolved downstream.
   *
   * These may include:
   * - Values that are pending emission due to throttling, audit, or
   *   other timing-based operators.
   * - Phantom values that were suppressed by an operator but
   *   need to be tracked for observability and debugging.
   */
  pendingResults: Set<StreamResult<any>>;

  /**
   * A stack of operator names representing the current pipeline order.
   * Useful for debugging or tracing the flow of values through operators.
   */
  operatorStack: string[];

  /**
   * A handler invoked when a value is filtered, dropped, or otherwise
   * not emitted by the current operator. Allows the pipeline to
   * account for "phantom" emissions without breaking the chain.
   *
   * @param value The suppressed or phantom value.
   * @returns A result indicating how the phantom should be processed.
   */
  phantomHandler: (value: any) => CallbackReturnType;

  /**
   * Resolves a pending result, removing it from the pendingResults set.
   * Operators that buffer values should use this when they finally emit the value.
   * @param result The stream result to resolve.
   */
  resolvePending: (result: StreamResult<any>) => CallbackReturnType;
}

/**
 * Creates and initializes a new PipeContext object for a stream pipeline.
 * * This function provides a clean, reusable way to set up the necessary
 * tracking mechanisms for a stream, ensuring that the pending results,
 * operator stack, and handler functions are properly configured from the start.
 * * @param [initialPhantomHandler] An optional function to handle phantom values. Defaults to a no-op function.
 * @param [initialResolvePending] An optional function to resolve pending values. Defaults to a function that removes the result from the pendingResults set.
 * @returns A new PipeContext instance.
 */
export function createContext(
  initialPhantomHandler?: (value: any) => CallbackReturnType,
  initialResolvePending?: (result: StreamResult<any>) => CallbackReturnType
): PipeContext {
  const pendingResults = new Set<StreamResult<any>>();

  const resolvePending = initialResolvePending || ((result: StreamResult<any>) => {
    pendingResults.delete(result);
  });

  const phantomHandler = initialPhantomHandler || (() => {
    // Default phantom handler does nothing, but you could log here for debugging.
  });

  return {
    pendingResults,
    operatorStack: [],
    phantomHandler,
    resolvePending,
  };
}
