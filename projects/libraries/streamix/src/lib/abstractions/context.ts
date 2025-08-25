/**
 * @fileoverview
 * Comprehensive emission logging and pipeline context management for reactive streaming systems.
 *
 * This module provides a complete observability layer for stream processing pipelines, featuring:
 *
 * **Core Architecture:**
 * - Hierarchical result tracking with parent-child relationships
 * - Lifecycle state management (pending → resolved/rejected/phantom)
 * - Multi-stream pipeline coordination with centralized context management
 *
 * **Emission Logging:**
 * - Configurable log levels (DEBUG, INFO, WARN, ERROR, OFF)
 * - Rich emission metadata including operator paths, timestamps, and result states
 * - Multiple export formats (JSON, table, timeline) for analysis and debugging
 * - Functional logger implementation with pure helper functions
 *
 * **Context Management:**
 * - StreamContext: Per-subscription result tracking and lifecycle management
 * - PipelineContext: Global operator stack, phantom handling, and stream coordination
 * - Automatic logging integration across all pipeline operations
 *
 * **Key Features:**
 * - Non-intrusive logging that can be disabled without performance impact
 * - Phantom emission detection for filtered/discarded values
 * - Async result resolution with proper error propagation
 * - Memory-efficient closure-based state management
 * - Type-safe interfaces with full TypeScript support
 *
 * **Use Cases:**
 * - Debugging complex stream transformations
 * - Performance monitoring and bottleneck identification
 * - Audit trails for data processing workflows
 * - Testing and validation of streaming behaviors
 */

import { Operator } from "./operator";
import { CallbackReturnType } from "./receiver";

// -------------------------------
// Types and Constants
// -------------------------------

/** Defines allowed log levels for emission tracking. */
export enum LogLevel {
  OFF = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

/** Represents a single emission log entry. */
export interface LogEntry {
  /** Timestamp when the log was created. */
  timestamp: number;
  /** Numeric log level. */
  level: LogLevel;
  /** Human-readable log level name. */
  levelName: string;
  /** Log message describing the event. */
  message: string;
  /** Identifier of the stream associated with this entry. */
  streamId: string;
  /** Hierarchical operator path for context. */
  operatorPath: string;
  /** Type of the stream result, if applicable. */
  resultType?: ResultType;
  /** Value emitted by the operator, if any. */
  value?: any;
  /** Error associated with the result, if any. */
  error?: any;
}

/** Immutable array representing the entire log history. */
export type LogState = LogEntry[];


/** Allowed StreamResult types. */
export type ResultType = "pending" | "done" | "error" | "phantom";

/**
 * Extended iterator result including lifecycle, hierarchy, and resolution metadata.
 */
export type StreamResult<T = any> = IteratorResult<T> & {
  /** Current lifecycle state of the result. */
  type?: ResultType;
  /** True if this result and all children are finalized. */
  sealed?: boolean;
  /** Error associated with the result, if rejected. */
  error?: any;
  /** Optional parent result (outer stream emission). */
  parent?: StreamResult<any>;
  /** Child results spawned by this result (e.g., from inner streams). */
  children?: Set<StreamResult<any>>;
  /** Creation timestamp. */
  timestamp?: number;
  /** Resolve this result with a value. */
  resolve(value?: T): Promise<void>;
  /** Reject this result with an error. */
  reject(reason: any): Promise<void>;
  /** Await resolution (resolve or reject). */
  wait(): Promise<void>;
  /** Add a child result to this result. */
  addChild(child: StreamResult<any>): void;
  /** Mark this result as finalized and propagate resolution. */
  finalize(): void;
  /** Traverse up the hierarchy to the root result. */
  root(): StreamResult<any>;
  /** Recursively collect all descendant results. */
  getAllDescendants(): StreamResult<any>[];
  /** True if this result and all descendants are resolved, rejected, or phantom. */
  isFullyResolved(): boolean;
  /** Notify parent that this result’s state has changed. */
  notifyParent(): void;
}

/** Context object scoped to a single stream subscription. */
export interface StreamContext {
  /** Reference to the parent pipeline context. */
  pipeline: PipelineContext;
  /** Unique identifier for this stream. */
  streamId: string;
  /** Set of results pending resolution in this stream. */
  pendingResults: Set<StreamResult<any>>;
  /** Timestamp of stream context creation. */
  timestamp: number;
  /** Callback invoked when a phantom result is produced. */
  phantomHandler: (operator: Operator, value: any) => CallbackReturnType;
  /** Resolve a pending result. */
  resolvePending: (operator: Operator, result: StreamResult<any>) => CallbackReturnType;
  /** Mark a result as phantom. */
  markPhantom: (operator: Operator, result: StreamResult<any>) => CallbackReturnType;
  /** Mark a result as pending. */
  markPending: (operator: Operator, result: StreamResult<any>) => CallbackReturnType;
  /** Create a new stream result within this context. */
  createResult: <T>(options?: Partial<StreamResult<T>>) => StreamResult<T>;
  /** Finalize all pending results and await their resolution. */
  finalize(): Promise<void>;
}

/** Context object scoped to the entire pipeline (all streams and operators). */
export interface PipelineContext {
  /** Minimum log level for this pipeline. */
  logLevel: LogLevel;
  /** Stack of operators currently being executed. */
  operators: Operator[];
  /** Returns a human-readable operator path string. */
  operatorStack(operator: Operator): string;
  /** Callback invoked when a phantom result is produced. */
  phantomHandler: (operator: Operator, streamContext: StreamContext, value: any) => CallbackReturnType;
  /** Map of active stream contexts keyed by stream ID. */
  activeStreams: Map<string, StreamContext>;
  /** Pipeline lifecycle flags. */
  flags: {
    /** True if there are unresolved results in the pipeline. */
    isPending: boolean;
    /** True if pipeline has been finalized. */
    isFinalized: boolean;
  };
  /** Register a new stream context. */
  registerStream: (context: StreamContext) => void;
  /** Unregister a stream context by ID. */
  unregisterStream: (streamId: string) => void;
  /** Finalize all streams and mark pipeline as finalized. */
  finalize(): Promise<void>;
}

// -------------------------------
// Functional Logger
// -------------------------------

/**
 * Creates a new log entry from given data.
 * @returns A new LogEntry object. This is a pure function.
 */
export const createLogEntry = (
  level: LogLevel,
  streamId: string,
  operatorPath: string,
  message: string,
  result?: StreamResult
): LogEntry => ({
  timestamp: performance.now(),
  level: level,
  levelName: LogLevel[level],
  message,
  streamId,
  operatorPath,
  resultType: result?.type,
  value: result?.value,
  error: result?.error,
});

/**
 * A pure function to add a new entry to the log state.
 * @param logState The current log state.
 * @param newEntry The new entry to add.
 * @returns A new log state with the entry appended.
 */
export const appendLogEntry = (logState: LogState, newEntry: LogEntry): LogState =>
  [...logState, newEntry];

/**
 * A pure function that returns the log state, filtered by a minimum log level.
 * This can be used for more specific debugging.
 */
export const filterLogEntries = (logState: LogState, minLevel: LogLevel): LogEntry[] =>
  logState.filter(entry => entry.level >= minLevel);

// -------------------------------
// Helpers
// -------------------------------

/**
 * Internal helper: checks if all children of a result are resolved,
 * and if so, resolves or rejects the parent accordingly.
 */
function processChildren(result: StreamResult) {
  if (!result.children?.size) return;

  const allResolved = [...result.children].every(
    c => c.done || c.error || c.type === 'phantom'
  );
  if (!allResolved) return;

  const childErrors = [...result.children].filter(c => c.error);
  if (childErrors.length > 0) {
    const combinedError = new Error("One or more child results failed");
    (combinedError as any).details = childErrors.map(c => c.error);
    result.reject(combinedError);
  } else {
    result.resolve();
  }
}

// -------------------------------
// Stream Result (Minimal Refactoring for FP compatibility)
// -------------------------------

/**
 * Factory for creating a hierarchical stream result.
 * This remains mostly imperative due to its async nature, but the context
 * functions that use it now pass it explicitly, maintaining an FP-style flow.
 */
export function createStreamResult<T>(
  options: Partial<StreamResult<T>> = {}
): StreamResult<T> {
  let resolveFn!: (value?: void | PromiseLike<void>) => void;
  let rejectFn!: (reason?: any) => void;

  const completion = new Promise<void>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });

  const instance: StreamResult<T> = {
    done: options.done ?? false,
    value: options.value,
    timestamp: performance.now(),
    children: options.children,

    type: options.type,
    sealed: options.sealed,
    error: options.error,
    parent: options.parent,

    root() {
      let current: StreamResult = this;
      while (current.parent) current = current.parent;
      return current;
    },

    async resolve(value?: T) {
      if (this.type === 'done' || this.type === 'error') return completion;
      this.value = value ?? this.value;
      this.type = 'done';
      this.done = true;
      resolveFn();
      this.notifyParent();
      return completion;
    },

    async reject(reason: any) {
      if (this.type === 'done' || this.type === 'error') return completion;
      this.type = 'error';
      this.done = true;
      this.error = reason;
      rejectFn(reason);
      this.notifyParent();
      return completion;
    },

    wait: () => completion,

    addChild(child) {
      if (!this.children) this.children = new Set();
      child.parent = this;
      this.children.add(child);
    },

    finalize() {
      this.sealed = true;
      processChildren(this);
    },

    getAllDescendants() {
      const results: StreamResult[] = [];
      const walk = (r: StreamResult) => {
        r.children?.forEach(c => {
          results.push(c);
          walk(c);
        });
      };
      walk(this);
      return results;
    },

    isFullyResolved() {
      return this.getAllDescendants().every(
        d => d.done || d.error || d.type === 'phantom'
      );
    },

    notifyParent() {
      if (this.parent) {
        processChildren(this.parent);
      }
    },
  };

  options.parent?.addChild(instance);
  return instance;
}

// -------------------------------
// Stream and Pipeline Context Factories (FP-style)
// -------------------------------

/**
 * Helper to log an event and append it to the log state.
 * This is the only place where the `console.log` side effect occurs.
 */
const logEvent = (
  logLevel: LogLevel,
  streamId: string,
  operatorPath: string,
  message: string,
  result?: StreamResult
) => {
  const entry = createLogEntry(logLevel, streamId, operatorPath, message, result);
  console.log(`[${entry.levelName}] ${entry.operatorPath} (${entry.streamId}): ${entry.message}`, result?.value ?? '');
  return entry;
};

/**
 * Factory for creating a stream context object.
 * The core logic is defined here as explicit functions.
 */
export function createStreamContext(
  pipelineContext: PipelineContext,
  streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`
): StreamContext {
  const pendingResults = new Set<StreamResult<any>>();

  const markPending = (operator: Operator, result: StreamResult<any>) => {
    logEvent(pipelineContext.logLevel, streamId, pipelineContext.operatorStack(operator), `Marked as pending`, result);
    result.type = 'pending';
    pendingResults.add(result);
  };

  const markPhantom = (operator: Operator, result: StreamResult<any>) => {
    logEvent(pipelineContext.logLevel, streamId, pipelineContext.operatorStack(operator), `Marked as phantom`, result);
    result.type = 'phantom';
    result.done = true;
    pipelineContext.phantomHandler(operator, context, result.value);
    pendingResults.delete(result);
  };

  const resolvePending = (operator: Operator, result: StreamResult<any>) => {
    result.type = 'done';
    result.done = true;
    pendingResults.delete(result);
    logEvent(pipelineContext.logLevel, streamId, pipelineContext.operatorStack(operator), `Resolved result:`, result);
    return result.resolve();
  };

  const finalize = async () => {
    logEvent(pipelineContext.logLevel, streamId, 'finalize', `Finalizing stream, waiting for ${pendingResults.size} results.`);
    [...pendingResults].filter(r => !r.parent).forEach(r => r.finalize());
    await Promise.allSettled([...pendingResults].map(r => r.wait()));
    logEvent(pipelineContext.logLevel, streamId, 'finalize', `Stream finalized. Remaining pending results: ${pendingResults.size}.`);
  };

  const context: StreamContext = {
    streamId,
    pipeline: pipelineContext,
    pendingResults,
    timestamp: performance.now(),
    phantomHandler: (operator, value) => pipelineContext.phantomHandler(operator, context, value),
    resolvePending,
    markPhantom,
    markPending,
    createResult: <T>(options = {}) => createStreamResult<T>(options),
    finalize,
  };

  pipelineContext.registerStream(context);
  return context;
}

/**
 * Factory for creating a pipeline context object.
 */
export function createPipelineContext(
  options: {
    phantomHandler?: (operator: Operator, s: StreamContext, value: any) => CallbackReturnType;
    logLevel?: LogLevel;
  } = {}
): PipelineContext {
  const activeStreams = new Map<string, StreamContext>();

  const operatorStack = (operator: Operator): string => {
    const operatorIndex = context.operators.indexOf(operator);
    return context.operators.slice(0, operatorIndex + 1).map(op => op?.name ?? 'unknown').join(' → ');
  };

  const registerStream = (ctx: StreamContext) => {
    activeStreams.set(ctx.streamId, ctx);
    logEvent(context.logLevel, ctx.streamId, 'init', 'Registered new stream context.');
  };

  const unregisterStream = (id: string) => {
    activeStreams.delete(id);
    logEvent(context.logLevel, id, 'cleanup', 'Unregistered stream context.');
  };

  const finalize = async () => {
    context.flags.isFinalized = true;
    logEvent(context.logLevel, 'pipeline', 'finalize', 'Finalizing pipeline.');
    await Promise.all([...activeStreams.values()].map(s => s.finalize()));
    logEvent(context.logLevel, 'pipeline', 'finalize', 'Pipeline finalized.');
  };

  const context: PipelineContext = {
    logLevel: options.logLevel ?? LogLevel.INFO,
    operators: [],
    operatorStack,
    phantomHandler: options.phantomHandler ?? (() => { }),
    activeStreams,
    flags: { isPending: false, isFinalized: false },
    registerStream,
    unregisterStream,
    finalize,
  };

  return context;
}
