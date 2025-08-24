import { Operator } from "./operator";
import { CallbackReturnType } from "./receiver";

/**
 * Extended iterator result with lifecycle and hierarchy metadata.
 */
export type StreamResult<T = any> = IteratorResult<T> & {
  /** True if this result was produced but not emitted (phantom emission). */
  phantom?: boolean;

  /** True if this result is still unresolved (waiting on children or async). */
  pending?: boolean;


  /** True if the result and its children have been finalized. */
  finalized?: boolean;

  /** Error associated with this result, if rejected. */
  error?: any;

  /** Optional parent result (outer stream emission). */
  parent?: StreamResult<any>;

  /** Child results spawned by this result (e.g. from inner streams). */
  children?: Set<StreamResult<any>>;

  /** Timestamp when this result was created. */
  timestamp?: number;

  /** Resolve this result as successful. */
  resolve(value?: T): Promise<void>;

  /** Reject this result with an error. */
  reject(reason: any): Promise<void>;

  /** Await resolution (resolve or reject). */
  wait(): Promise<void>;

  /** Add a child result to this result. */
  addChild(child: StreamResult<any>): void;

  /** Mark this result as finalized and check child resolution. */
  finalize(): void;

  /** Walk up the hierarchy to return the root result. */
  root(): StreamResult<any>;

  /** Recursively collect all descendant results. */
  getAllDescendants(): StreamResult<any>[];

  /** True if this result and all descendants are resolved/rejected/phantom. */
  isFullyResolved(): boolean;

  /** Notify the parent that this result’s state has changed. */
  notifyParent(): void;
}

/**
 * Context object scoped to a single stream instance (one subscription).
 *
 * - Tracks all pending results for that stream.
 * - Provides helpers to create results and resolve them.
 * - Works together with a `PipelineContext` to manage lifecycles.
 */
export interface StreamContext {
  /** Reference to the parent pipeline context */
  pipeline: PipelineContext;

  /** Unique identifier for this stream. */
  streamId: string;

  /** Set of results still waiting for resolution. */
  pendingResults: Set<StreamResult<any>>;

  /** Creation timestamp of this stream context. */
  timestamp: number;

  /** Callback invoked when a phantom result is produced. */
  phantomHandler: (operator: Operator, value: any) => CallbackReturnType;

  /**
   * Resolve a pending result and remove it from the pending set.
   */
  resolvePending: (result: StreamResult<any>) => CallbackReturnType;

  /**
   * Mark a result as phantom (produced but not emitted) and handle via pipeline phantomHandler.
   */
  markPhantom: (operator: Operator, result: StreamResult<any>) => CallbackReturnType;

  /**
   * Create a new result associated with this stream.
   */
  createResult: <T>(
    options?: Partial<StreamResult<T>>
  ) => StreamResult<T>;

  /**
   * Finalize this stream context:
   * - Forces all top-level pending results to finalize.
   * - Awaits resolution of all remaining pending results.
   */
  finalize(): Promise<void>;
}

/**
 * Context object scoped to the entire pipeline (all operators + streams).
 *
 * - Tracks active streams.
 * - Coordinates phantom emissions.
 * - Handles global lifecycle flags (pending, finalized).
 */
export interface PipelineContext {
  /** Stack of operator names currently being executed (for debugging). */
  operatorList: Operator[];

  /** Callback invoked when a phantom result is produced. */
  phantomHandler: (operator: Operator, streamContext: StreamContext, value: any) => CallbackReturnType;

  /** Active stream contexts in this pipeline. */
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

  /**
   * Finalize the pipeline:
   * - Marks as finalized.
   * - Finalizes all active streams.
   */
  finalize(): Promise<void>;
}

/**
 * Operator execution context.
 *
 * Passed into each operator so it can:
 * - Create results via `stream.createResult`.
 * - Access pipeline-wide state via `pipeline`.
 */
export interface OperatorContext {
  /** Context for the current stream subscription. */
  stream: StreamContext;
  /** Shared pipeline context across all streams. */
  pipeline: PipelineContext;
}

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
    c => c.done || c.error || c.phantom
  );
  if (!allResolved) return;

  result.pending = false;
  result.done = true;

  if ([...result.children].some(c => c.error)) {
    result.reject(new Error("One or more child results failed"));
  } else {
    result.resolve();
  }
}

// -------------------------------
// Stream Result
// -------------------------------

/**
 * Factory for creating a hierarchical stream result.
 *
 * @param options Partial fields to initialize the result with (e.g. parent, value).
 * @returns A new `HierarchicalStreamResult` instance.
 */
export function createStreamResult<T>(
  options: Partial<StreamResult<T>> = {}
): StreamResult<T> {
  let resolveFn!: () => void;
  let rejectFn!: (reason: any) => void;

  const completion = new Promise<void>((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });

  const instance: StreamResult<T> = {
    done: options.done ?? false,
    value: options.value,
    timestamp: performance.now(),
    children: options.children, // may be undefined

    phantom: options.phantom,
    pending: options.pending ?? true,
    finalized: options.finalized,
    error: options.error,
    parent: options.parent,

    root() {
      let current: StreamResult = this;
      while (current.parent) current = current.parent;
      return current;
    },

    async resolve(value?: T) {
      this.value = value ?? this.value;
      resolveFn();
      this.pending = false;
      this.done = true;
      this.notifyParent();
      return completion;
    },

    async reject(reason: any) {
      rejectFn(reason);
      this.pending = false;
      this.done = true;
      this.error = reason;
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
      this.finalized = true;
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
        d => d.done || d.error || d.phantom
      );
    },

    notifyParent() {
      if (this.parent?.finalized) {
        processChildren(this.parent);
      }
    },
  };

  options.parent?.addChild(instance);
  return instance;
}

// -------------------------------
// Stream Context
// -------------------------------

/**
 * Factory for creating a stream context.
 *
 * - Each stream subscription gets its own context.
 * - Manages pending results and interacts with the pipeline.
 *
 * @param pipelineContext Parent pipeline context.
 * @param streamId Optional custom ID (default: autogenerated).
 */
export function createStreamContext(
  pipelineContext: PipelineContext,
  streamId = `stream_${Date.now()}_${Math.random().toString(36).slice(2)}`
): StreamContext {
  const pendingResults = new Set<StreamResult<any>>();

  const addIfPending = <T>(r: StreamResult<T>) => {
    if (r.pending) pendingResults.add(r);
    return r;
  };

  const context: StreamContext = {
    streamId,
    pipeline: pipelineContext,
    pendingResults,
    timestamp: performance.now(),

    phantomHandler(operator, value) {
      return this.pipeline.phantomHandler(operator, this, value);
    },

    resolvePending(result) {
      result.done = true; delete result.pending;
      pendingResults.delete(result);
      return result.resolve();
    },

    markPhantom(operator, result) {
      result.done = true; result.phantom = true; delete result.pending;
      pipelineContext.phantomHandler(operator, this, result.value);
      pendingResults.delete(result);
    },

    createResult<T>(options = {}) {
      return addIfPending(createStreamResult<T>(options));
    },

    async finalize() {
      [...pendingResults].filter(r => !r.parent).forEach(r => r.finalize());
      await Promise.all([...pendingResults].map(r => r.wait()));
    }
  };

  pipelineContext.registerStream(context);
  return context;
}

// -------------------------------
// Pipeline Context
// -------------------------------

/**
 * Factory for creating a pipeline context.
 *
 * - One pipeline context exists per call to `pipeStream`.
 * - Coordinates all stream contexts, phantom handling, and finalization.
 *
 * @param phantomHandler Optional callback for phantom results (default: console.debug).
 */
export function createPipelineContext(
  phantomHandler: (operator: Operator, s: StreamContext, value: any) => CallbackReturnType = (operator: Operator, s: StreamContext, value: any) => {
    if (!s.pipeline) return;

      // Find the operator index in the stream's operator list
      const operatorList = s.pipeline.operatorList ?? []; // assume we store full list here
      const operatorIndex = operatorList.indexOf(operator);

      // Slice path from first operator to current
      let path = '';
      for (let i = 0; i <= operatorIndex; i++) {
        path += (i > 0 ? ' → ' : '') + (operatorList[i].name ?? 'unknown');
      }

      console.log(`👻 ${path} :`, value);

      // Return whatever your CallbackReturnType expects
      return undefined;
  }
): PipelineContext {
  const activeStreams = new Map<string, StreamContext>();

  return {
    operatorList: [],
    phantomHandler,
    activeStreams,
    flags: { isPending: false, isFinalized: false },

    registerStream(ctx) {
      activeStreams.set(ctx.streamId, ctx);
    },

    unregisterStream(id) {
      activeStreams.delete(id);
    },

    async finalize() {
      this.flags.isFinalized = true;
      await Promise.all([...activeStreams.values()].map(s => s.finalize()));
    }
  };
}
