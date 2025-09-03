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

export type StreamResult<T = any> = IteratorResult<T> & Partial<{
  type: ResultType;
  sealed: boolean;
  error: any;
  parent: StreamResult<any>;
  children: Set<StreamResult<any>>;
  timestamp: number;
  resolve(value?: T): Promise<void>;
  reject(reason: any): Promise<void>;
  wait(): Promise<void>;
  addChild(child: StreamResult<any>): void;
  finalize(): void;
  root(): StreamResult<any>;
  getAllDescendants(): StreamResult<any>[];
  isFullyResolved(): boolean;
  notifyParent(): void;
}>;

export interface StreamContext {
  pipeline: PipelineContext;
  streamId: string;
  pendingResults: Set<StreamResult>;
  timestamp: number;
  phantomHandler: (operator: Operator, value: any) => CallbackReturnType;
  resolvePending: (operator: Operator, result: StreamResult) => CallbackReturnType;
  markPhantom: (operator: Operator, result: StreamResult) => CallbackReturnType;
  markPending: (operator: Operator, result: StreamResult) => CallbackReturnType;
  createResult: (options: StreamResult) => StreamResult;
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
  registerStream(stream: Stream, parent?: StreamContext): StreamContext;
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

export const shouldLog = (threshold: LogLevel, severity: LogLevel): boolean => {
  if (threshold === LogLevel.OFF) return false;
  return severity <= threshold;
};

export const filterLogEntries = (logState: LogState, minLevel: LogLevel): LogEntry[] =>
  logState.filter(entry => entry.level <= minLevel);

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
  if (severity > threshold) return null;

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

export function createStreamResult<T = any>(options: StreamResult<T>): StreamResult<T> {
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
      this.notifyParent!();
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
          this.reject!(combinedError);
        } else {
          this.resolve!();
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
      return this.getAllDescendants!().every(d => d.done || d.error || d.type === 'phantom');
    },

    notifyParent() {
      if (this.parent) { this.parent.finalize!(); }
    },
  };

  options.parent?.addChild!(instance);
  return instance;
}

// -------------------------------
// StreamContext Factory
// -------------------------------

export function createStreamContext(
  stream: Stream,
  context: PipelineContext,
): StreamContext {
  const streamId = `${stream.name}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const pendingResults = new Set<StreamResult>();

  const markPending = (operator: Operator, result: StreamResult) => {
    logEvent(
      context.logLevel,
      LogLevel.INFO,
      streamId,
      context.operatorStack(operator),
      'Marked as pending',
      result,
    );
    result.type = 'pending';
    pendingResults.add(result);
  };

  const markPhantom = (operator: Operator, result: StreamResult) => {
    logEvent(
      context.logLevel,
      LogLevel.DEBUG,
      streamId,
      context.operatorStack(operator),
      'Marked as phantom',
      result,
    );
    result.type = 'phantom';
    result.done = true;
    context.phantomHandler(operator, sc, result.value);
    pendingResults.delete(result);
  };

  const resolvePending = (operator: Operator, result: StreamResult) => {
    result.type = 'done';
    result.done = true;
    pendingResults.delete(result);
    logEvent(
      context.logLevel,
      LogLevel.INFO,
      streamId,
      context.operatorStack(operator),
      'Resolved result:',
      result,
    );
    
    (result && 'resolve' in result) && result.resolve!();
  };

  const logFlow = (
    eventType: 'emitted' | 'pending' | 'resolved' | 'phantom' | 'error',
    operator: Operator | null,
    result?: any,
    message?: string,
  ) => {
    if (!context.flowLoggingEnabled) return;
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

    if (eventLevel > context.flowLogLevel) return;

    const opPath =
      operator !== null ? context.operatorStack(operator) : '';
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
      context.logLevel,
      LogLevel.INFO,
      streamId,
      'finalize',
      `Finalizing stream, waiting for ${pendingResults.size} results.`,
    );
    [...pendingResults].forEach(r => (r && 'finalize' in r) && r.finalize!());
    await Promise.all([...pendingResults].map(r => (r && 'wait' in r && r.wait!()) || Promise.resolve()));
    logEvent(
      context.logLevel,
      LogLevel.INFO,
      streamId,
      'finalize',
      `Stream finalized. Remaining pending results: ${pendingResults.size}.`,
    );
  };

  const sc: StreamContext = {
    streamId,
    pipeline: context,
    pendingResults,
    timestamp: performance.now(),
    phantomHandler: (operator, value) =>
      context.phantomHandler(operator, sc, value),
    resolvePending,
    markPhantom,
    markPending,
    createResult: (options) => createStreamResult(options!),
    logFlow,
    finalize,
  };

  context.registerStream(stream, sc);
  return sc;
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

  let context: PipelineContext;

  const operatorStack = (operator: Operator): string => {
    const operatorIndex = context.operators.indexOf(operator);
    return context.operators.slice(0, operatorIndex + 1).map(op => op?.name ?? 'unknown').join(' → ');
  };

  const currentStreamContext = (): StreamContext => streamStack[streamStack.length - 1];

  const registerStream = (stream: Stream): StreamContext => {
    const streamId = `${stream.name}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const pendingResults = new Set<StreamResult>();

    const streamContext: StreamContext = {
      streamId,
      pipeline: context,
      pendingResults,
      timestamp: performance.now(),
      phantomHandler: (op, value) => context.phantomHandler(op, streamContext, value),
      resolvePending: (op, result) => {
        void op;
        result.type = 'done';
        result.done = true;
        pendingResults.delete(result);
        (result && 'resolve' in result) && result.resolve!();
      },
      markPhantom: (op, result) => {
        result.type = 'phantom';
        result.done = true;
        pendingResults.delete(result);
        context.phantomHandler(op, streamContext, result.value);
      },
      markPending: (op, result) => {
        void op;
        result.type = 'pending';
        pendingResults.add(result);
      },
      createResult: <T>(options: StreamResult) => createStreamResult<T>({ ...options }),
      logFlow: (
        eventType: 'emitted' | 'pending' | 'resolved' | 'phantom' | 'error',
        operator: Operator | null,
        result?: any,
        message?: string,
      ) => {
        if (!context.flowLoggingEnabled) return;
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

        if (eventLevel > context.flowLogLevel) return;

        const opPath =
          operator !== null ? context.operatorStack(operator) : '';
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
      },
      finalize: async () => {
        [...pendingResults].forEach(r => (r && 'finalize' in r) && r.finalize!());
        await Promise.all([...pendingResults].map(r => (r && 'wait' in r && r.wait!()) || Promise.resolve()));
      }
    };

    // Register automatically
    activeStreams.set(streamId, streamContext);
    streamStack.push(streamContext);
    return streamContext;
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

  context = {
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
