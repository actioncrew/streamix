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

  /**
   * Handles a phantom (suppressed) result by calling the phantom handler
   * and removing it from the pending results set.
   * @param result The stream result to mark as phantom and resolve.
   */
  phantomPending: (result: StreamResult<any>) => CallbackReturnType;
}

/**
 * Creates and initializes a new PipeContext object for a stream pipeline.
 * This function provides a clean, reusable way to set up the necessary
 * tracking mechanisms for a stream, ensuring that the pending results,
 * operator stack, and handler functions are properly configured from the start.
 * @param [initialPhantomHandler] An optional function to handle phantom values. Defaults to a no-op function.
 * @returns A new PipeContext instance.
 */
export function createContext(
  initialPhantomHandler?: (value: any) => CallbackReturnType
): PipeContext {
  const pendingResults = new Set<StreamResult<any>>();

  // The phantomHandler is a simple callback for a dropped value.
  const phantomHandler = initialPhantomHandler || (() => {
    // Default phantom handler does nothing, but can be customized.
  });

  // The resolvePending function removes the item from the pending set.
  const resolvePending = (result: StreamResult<any>) => {
    pendingResults.delete(result);
  };

  // The phantomPending function is a combination of phantomHandler and resolvePending.
  const phantomPending = (result: StreamResult<any>) => {
    phantomHandler(result.value);
    pendingResults.delete(result);
  };

  return {
    pendingResults,
    operatorStack: [],
    phantomHandler,
    resolvePending,
    phantomPending
  };
}
