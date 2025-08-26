/**
 * @fileoverview
 * Comprehensive emission logging and pipeline context management for reactive streaming systems.
 */

import { Operator } from "./operator";
import { CallbackReturnType } from "./receiver";
import { Stream } from "./stream";

// -------------------------------
// Types and Constants
// -------------------------------

export enum LogLevel {
  OFF = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export type ResultType = "pending" | "done" | "error" | "phantom";

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  levelName: string;
  message: string;
  streamId: string;
  operatorPath: string;
  resultType?: ResultType;
  value?: any;
  error?: any;
}

export type LogState = LogEntry[];

export type StreamResult<T = any> = IteratorResult<T> & {
  type?: ResultType;
  sealed?: boolean;
  error?: any;
  parent?: StreamResult<any>;
  children?: Set<StreamResult<any>>;
  timestamp?: number;
  resolve(value?: T): Promise<void>;
  reject(reason: any): Promise<void>;
  wait(): Promise<void>;
  addChild(child: StreamResult<any>): void;
  finalize(): void;
  root(): StreamResult<any>;
  getAllDescendants(): StreamResult<any>[];
  isFullyResolved(): boolean;
  notifyParent(): void;
};

export interface StreamContext {
  pipeline: PipelineContext;
  streamId: string;
  pendingResults: Set<StreamResult<any>>;
  timestamp: number;
  phantomHandler: (operator: Operator, value: any) => CallbackReturnType;
  resolvePending: (operator: Operator, result: StreamResult<any>) => CallbackReturnType;
  markPhantom: (operator: Operator, result: StreamResult<any>) => CallbackReturnType;
  markPending: (operator: Operator, result: StreamResult<any>) => CallbackReturnType;
  createResult: <T>(options?: Partial<StreamResult<T>>) => StreamResult<T>;
  logFlow(eventType: 'pending' | 'resolved' | 'phantom' | 'error',
    operator: Operator, result?: StreamResult<any>, message?: string
  ): void;
  finalize(): Promise<void>;
}

export interface PipelineContext {
  logLevel: LogLevel;
  operators: Operator[];
  flowLoggingEnabled: boolean;
  operatorStack(operator: Operator): string;
  phantomHandler: (operator: Operator, streamContext: StreamContext, value: any) => CallbackReturnType;
  activeStreams: Map<string, StreamContext>;
  flags: { isPending: boolean; isFinalized: boolean };
  streamStack: StreamContext[];
  currentStreamContext(): StreamContext;
  registerStream(context: StreamContext): void;
  unregisterStream(streamId: string): void;
  finalize(): Promise<void>;
}

// -------------------------------
// Logging Helpers
// -------------------------------

export const createLogEntry = (
  level: LogLevel,
  streamId: string,
  operatorPath: string,
  message: string,
  result?: StreamResult
): LogEntry => ({
  timestamp: performance.now(),
  level,
  levelName: LogLevel[level],
  message,
  streamId,
  operatorPath,
  resultType: result?.type,
  value: result?.value,
  error: result?.error,
});

export const appendLogEntry = (logState: LogState, newEntry: LogEntry): LogState => [...logState, newEntry];

export const filterLogEntries = (logState: LogState, minLevel: LogLevel): LogEntry[] =>
  logState.filter(entry => entry.level >= minLevel);

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

// -------------------------------
// StreamResult Factory
// -------------------------------

export function createStreamResult<T>(options: Partial<StreamResult<T>> = {}): StreamResult<T> {
  let resolveFn!: (value?: void | PromiseLike<void>) => void;
  let rejectFn!: (reason?: any) => void;
  const completion = new Promise<void>((res, rej) => { resolveFn = res; rejectFn = rej; });

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
      if (!this.children?.size) return;
      const allResolved = [...this.children].every(c => c.done || c.error || c.type === 'phantom');
      if (allResolved) {
        const childErrors = [...this.children].filter(c => c.error);
        if (childErrors.length > 0) {
          const combinedError = new Error("One or more child results failed");
          (combinedError as any).details = childErrors.map(c => c.error);
          this.reject(combinedError);
        } else {
          this.resolve();
        }
      }
    },

    getAllDescendants() {
      const results: StreamResult[] = [];
      const walk = (r: StreamResult) => { r.children?.forEach(c => { results.push(c); walk(c); }); };
      walk(this);
      return results;
    },

    isFullyResolved() {
      return this.getAllDescendants().every(d => d.done || d.error || d.type === 'phantom');
    },

    notifyParent() {
      if (this.parent) { this.parent.finalize(); }
    },
  };

  options.parent?.addChild(instance);
  return instance;
}

// -------------------------------
// StreamContext Factory
// -------------------------------

export function createStreamContext(pipelineContext: PipelineContext, stream: Stream): StreamContext {
  const streamId = `${stream.name}_${Date.now()}_${Math.random().toString(36).slice(2)}`
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

  const logFlow = (eventType: 'pending' | 'resolved' | 'phantom' | 'error',
    operator: Operator, result?: StreamResult<any>, message?: string
  ) => {
    if (!pipelineContext.flowLoggingEnabled) return;

    const opPath = pipelineContext.operatorStack(operator);
    const logMsg = message ?? `${eventType} ${result?.value ?? ''}`;
    console.log(`[FLOW] [${eventType}] [${streamId}] [${opPath}]: ${logMsg}`);
  }

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
    logFlow,
    finalize,
  };

  pipelineContext.registerStream(context);
  return context;
}

// -------------------------------
// PipelineContext Factory
// -------------------------------

export function createPipelineContext(options: { phantomHandler?: (operator: Operator, s: StreamContext, value: any) => CallbackReturnType; logLevel?: LogLevel } = {}): PipelineContext {
  const activeStreams = new Map<string, StreamContext>();
  const streamStack: StreamContext[] = [];

  const operatorStack = (operator: Operator): string => {
    const operatorIndex = context.operators.indexOf(operator);
    return context.operators.slice(0, operatorIndex + 1).map(op => op?.name ?? 'unknown').join(' → ');
  };

  const currentStreamContext = (): StreamContext => streamStack[streamStack.length - 1];

  const registerStream = (ctx: StreamContext) => {
    activeStreams.set(ctx.streamId, ctx);
    streamStack.push(ctx);
    logEvent(context.logLevel, ctx.streamId, 'init', 'Registered new stream context.');
  };

  const unregisterStream = (id: string) => {
    activeStreams.delete(id);
    const index = streamStack.findIndex(s => s.streamId === id);
    if (index >= 0) streamStack.splice(index, 1);
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
    flowLoggingEnabled: true,
    operatorStack,
    phantomHandler: options.phantomHandler ?? (() => {}),
    activeStreams,
    flags: { isPending: false, isFinalized: false },
    streamStack,
    currentStreamContext,
    registerStream,
    unregisterStream,
    finalize,
  };

  return context;
}
