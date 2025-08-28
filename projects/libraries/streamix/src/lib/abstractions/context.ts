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
  OFF   = 0,
  ERROR = 1,
  WARN  = 2,
  INFO  = 3,
  DEBUG = 4
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
  logFlow(eventType: 'emitted' | 'pending' | 'resolved' | 'phantom' | 'error',
    operator: Operator | null, result?: any, message?: string
  ): void;
  finalize(): Promise<void>;
}

export interface PipelineContext {
  logLevel: LogLevel;
  flowLogLevel: LogLevel;
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
// Console Color Constants
// -------------------------------

const ConsoleColors = {
  // LogLevel colors
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m',  // Yellow
  INFO: '\x1b[36m',  // Cyan
  DEBUG: '\x1b[35m', // Magenta

  // Flow event type colors
  FLOW_EMITTED: '\x1b[32m',  // Green
  FLOW_PENDING: '\x1b[33m',  // Yellow
  FLOW_RESOLVED: '\x1b[36m', // Cyan
  FLOW_PHANTOM: '\x1b[35m',  // Magenta
  FLOW_ERROR: '\x1b[31m',    // Red

  // Context colors
  STREAM_ID: '\x1b[90m',     // Gray
  OPERATOR_PATH: '\x1b[94m', // Blue
  MESSAGE: '\x1b[37m',       // White
  FLOW_LABEL: '\x1b[32m',    // Green (for [FLOW] label)
  VALUE: '\x1b[33m',         // Yellow (for values)

  // Reset
  RESET: '\x1b[0m'
} as const;

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

export const shouldLog = (threshold: LogLevel, severity: LogLevel): boolean => {
  if (threshold === LogLevel.OFF) return false;
  return severity <= threshold;
};

export const filterLogEntries = (logState: LogState, minLevel: LogLevel): LogEntry[] =>
  logState.filter(entry => entry.level <= minLevel);

// -------------------------------
// Color Helpers
// -------------------------------

const getLogLevelColor = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.ERROR: return ConsoleColors.ERROR;
    case LogLevel.WARN: return ConsoleColors.WARN;
    case LogLevel.INFO: return ConsoleColors.INFO;
    case LogLevel.DEBUG: return ConsoleColors.DEBUG;
    default: return ConsoleColors.RESET;
  }
};

const getFlowEventColor = (eventType: 'emitted' | 'pending' | 'resolved' | 'phantom' | 'error'): string => {
  switch (eventType) {
    case 'emitted': return ConsoleColors.FLOW_EMITTED;
    case 'pending': return ConsoleColors.FLOW_PENDING;
    case 'resolved': return ConsoleColors.FLOW_RESOLVED;
    case 'phantom': return ConsoleColors.FLOW_PHANTOM;
    case 'error': return ConsoleColors.FLOW_ERROR;
    default: return ConsoleColors.RESET;
  }
};

// -------------------------------
// Enhanced Logging Functions with Full Colorization
// -------------------------------

const logEvent = (
  threshold: LogLevel,
  severity: LogLevel,
  streamId: string,
  operatorPath: string,
  message: string,
  result?: StreamResult
) => {
  // store the actual severity on the entry
  const entry = createLogEntry(severity, streamId, operatorPath, message, result);

  const levelStyle = (() => {
    switch (severity) {
      case LogLevel.ERROR: return 'color: red; font-weight: bold;';
      case LogLevel.WARN:  return 'color: orange; font-weight: bold;';
      case LogLevel.INFO:  return 'color: teal; font-weight: bold;';
      case LogLevel.DEBUG: return 'color: purple; font-weight: bold;';
      default:             return 'color: black;';
    }
  })();

  const valueToLog = result?.value;
  if (valueToLog === undefined) {
    console.log(
      `%c[${entry.levelName}] %c${entry.operatorPath} %c(${entry.streamId}): %c${entry.message}`,
      levelStyle, 'color: blue;', 'color: gray;', 'color: black;'
    );
  } else {
    console.log(
      `%c[${entry.levelName}] %c${entry.operatorPath} %c(${entry.streamId}): %c${entry.message} %c${typeof valueToLog === 'object' ? JSON.stringify(valueToLog) : String(valueToLog)}`,
      levelStyle, 'color: blue;', 'color: gray;', 'color: black;', 'color: orange;'
    );
  }

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

export function createStreamContext(
  pipelineContext: PipelineContext,
  stream: Stream,
): StreamContext {
  const streamId = `${stream.name}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const pendingResults = new Set<StreamResult<any>>();

  const markPending = (operator: Operator, result: StreamResult<any>) => {
    logEvent(
      pipelineContext.logLevel,
      LogLevel.INFO,
      streamId,
      pipelineContext.operatorStack(operator),
      'Marked as pending',
      result,
    );
    result.type = 'pending';
    pendingResults.add(result);
  };

  const markPhantom = (operator: Operator, result: StreamResult<any>) => {
    logEvent(
      pipelineContext.logLevel,
      LogLevel.DEBUG,
      streamId,
      pipelineContext.operatorStack(operator),
      'Marked as phantom',
      result,
    );
    result.type = 'phantom';
    result.done = true;
    pipelineContext.phantomHandler(operator, context, result.value);
    pendingResults.delete(result);
  };

  const resolvePending = (operator: Operator, result: StreamResult<any>) => {
    result.type = 'done';
    result.done = true;
    pendingResults.delete(result);
    logEvent(
      pipelineContext.logLevel,
      LogLevel.INFO,
      streamId,
      pipelineContext.operatorStack(operator),
      'Resolved result:',
      result,
    );
    return result.resolve();
  };

  const logFlow = (
    eventType: 'emitted' | 'pending' | 'resolved' | 'phantom' | 'error',
    operator: Operator | null,
    result?: any,
    message?: string,
  ) => {
    if (!pipelineContext.flowLoggingEnabled) return;
    const eventLevel: LogLevel = (() => {
      switch (eventType) {
        case 'error':
          return LogLevel.ERROR;
        case 'pending':
        case 'phantom':
          return LogLevel.DEBUG; // very verbose
        case 'resolved':
        case 'emitted':
          return LogLevel.INFO;
        default:
          return LogLevel.DEBUG;
      }
    })();

    if (eventLevel > pipelineContext.flowLogLevel) return;

    const opPath =
      operator !== null ? pipelineContext.operatorStack(operator) : '';
    const logMsg = `${message ?? ''}`.trim();
    const hasResult = result !== undefined && result !== null;
    const resultStr = hasResult
      ? typeof result === 'object'
        ? JSON.stringify(result)
        : String(result)
      : '';

    // Browser with CSS styles - full message colorization
    const eventStyle = (() => {
      switch (eventType) {
        case 'emitted':
          return 'color: green; font-weight: bold;';
        case 'pending':
          return 'color: orange; font-weight: bold;';
        case 'resolved':
          return 'color: teal; font-weight: bold;';
        case 'phantom':
          return 'color: purple; font-weight: bold;';
        case 'error':
          return 'color: red; font-weight: bold;';
        default:
          return 'color: black;';
      }
    })();

    if (opPath) {
      if (hasResult) {
        console.log(
          `%c[FLOW] %c[${eventType}] %c[${streamId}] %c[${opPath}]: %c${logMsg} %c${resultStr}`,
          'color: darkgreen; font-weight: bold;',
          eventStyle,
          'color: gray;',
          'color: blue;',
          'color: black;',
          'color: orange;', // Yellow for values
        );
      } else {
        console.log(
          `%c[FLOW] %c[${eventType}] %c[${streamId}] %c[${opPath}]: %c${logMsg}`,
          'color: darkgreen; font-weight: bold;',
          eventStyle,
          'color: gray;',
          'color: blue;',
          'color: black;',
        );
      }
    } else {
      if (hasResult) {
        console.log(
          `%c[FLOW] %c[${eventType}] %c[${streamId}]: %c${logMsg} %c${resultStr}`,
          'color: darkgreen; font-weight: bold;',
          eventStyle,
          'color: gray;',
          'color: black;',
          'color: orange;', // Yellow for values
        );
      } else {
        console.log(
          `%c[FLOW] %c[${eventType}] %c[${streamId}]: %c${logMsg}`,
          'color: darkgreen; font-weight: bold;',
          eventStyle,
          'color: gray;',
          'color: black;',
        );
      }
    }
  };

  const finalize = async () => {
    logEvent(
      pipelineContext.logLevel,
      LogLevel.INFO,
      streamId,
      'finalize',
      `Finalizing stream, waiting for ${pendingResults.size} results.`,
    );
    [...pendingResults].filter((r) => !r.parent).forEach((r) => r.finalize());
    await Promise.allSettled([...pendingResults].map((r) => r.wait()));
    logEvent(
      pipelineContext.logLevel,
      LogLevel.INFO,
      streamId,
      'finalize',
      `Stream finalized. Remaining pending results: ${pendingResults.size}.`,
    );
  };

  const context: StreamContext = {
    streamId,
    pipeline: pipelineContext,
    pendingResults,
    timestamp: performance.now(),
    phantomHandler: (operator, value) =>
      pipelineContext.phantomHandler(operator, context, value),
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

export function createPipelineContext(options: {
  phantomHandler?: (operator: Operator, s: StreamContext, value: any) => CallbackReturnType;
  logLevel?: LogLevel;
  flowLogLevel?: LogLevel;
  flowLoggingEnabled?: boolean;
} = {}): PipelineContext {
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
    logEvent(context.logLevel, LogLevel.INFO, ctx.streamId, 'init', 'Registered new stream context.');
  };

  const unregisterStream = (id: string) => {
    activeStreams.delete(id);
    const index = streamStack.findIndex(s => s.streamId === id);
    if (index >= 0) streamStack.splice(index, 1);
    logEvent(context.logLevel, LogLevel.INFO, id, 'cleanup', 'Unregistered stream context.');
  };

  const finalize = async () => {
    context.flags.isFinalized = true;
    logEvent(context.logLevel, LogLevel.INFO, 'pipeline', 'finalize', 'Finalizing pipeline.');
    await Promise.all([...activeStreams.values()].map(s => s.finalize()));
    logEvent(context.logLevel, LogLevel.INFO, 'pipeline', 'finalize', 'Pipeline finalized.');
  };

  const context: PipelineContext = {
    logLevel: options.logLevel ?? LogLevel.WARN,
    flowLogLevel: options.flowLogLevel ?? LogLevel.INFO,
    operators: [],
    flowLoggingEnabled: options.flowLoggingEnabled ?? true,
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
