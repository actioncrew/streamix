import { CallbackReturnType, StreamContext } from "@actioncrew/streamix";

/**
 * Enhanced subscription lifecycle states for comprehensive inspection.
 */
export enum SubscriptionState {
  /** Subscription is newly created but not yet active */
  CREATED = 'created',
  /** Subscription is actively listening for values */
  ACTIVE = 'active',
  /** Subscription is in the process of unsubscribing */
  UNSUBSCRIBING = 'unsubscribing',
  /** Subscription has been completely terminated */
  UNSUBSCRIBED = 'unsubscribed',
  /** Subscription encountered an error during lifecycle */
  ERROR = 'error'
}

/**
 * Represents a single subscription lifecycle event for inspection and debugging.
 */
export interface SubscriptionEvent {
  /** Unique identifier for this subscription */
  subscriptionId: string;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Type of lifecycle event */
  event: 'created' | 'activated' | 'value_received' | 'error_received' | 'completed' | 'unsubscribing' | 'unsubscribed';
  /** Current state of the subscription */
  state: SubscriptionState;
  /** Associated stream ID, if applicable */
  streamId?: string;
  /** Value associated with the event (for value_received events) */
  value?: any;
  /** Error associated with the event (for error_received events) */
  error?: any;
  /** Additional contextual metadata */
  metadata?: Record<string, any>;
}

/**
 * Statistics for subscription performance and behavior analysis.
 */
export interface SubscriptionStats {
  /** Unique identifier for this subscription */
  subscriptionId: string;
  /** Associated stream ID */
  streamId?: string;
  /** Current lifecycle state */
  state: SubscriptionState;
  /** Total number of values received */
  valuesReceived: number;
  /** Total number of errors received */
  errorsReceived: number;
  /** Duration since subscription creation in milliseconds */
  duration: number;
  /** Average time between value emissions (ms) */
  averageEmissionInterval?: number;
  /** Peak memory usage during subscription lifecycle */
  peakMemoryUsage?: number;
  /** Whether subscription has active listeners */
  hasActiveListeners: boolean;
}

/**
 * Enhanced subscription interface with comprehensive inspection capabilities.
 */
export interface InspectableSubscription extends Subscription {
  /** Unique identifier for this subscription */
  readonly subscriptionId: string;
  /** Current lifecycle state */
  readonly state: SubscriptionState;
  /** Associated stream context for pipeline integration */
  readonly streamContext?: StreamContext;
  /** Timeline of all subscription lifecycle events */
  readonly events: ReadonlyArray<SubscriptionEvent>;
  /** Get current subscription statistics */
  getStats(): SubscriptionStats;
  /** Add a custom inspection hook */
  addInspectionHook(hook: SubscriptionInspectionHook): void;
  /** Remove an inspection hook */
  removeInspectionHook(hook: SubscriptionInspectionHook): void;
}

/**
 * Hook function for custom subscription inspection and monitoring.
 */
export type SubscriptionInspectionHook = (event: SubscriptionEvent, subscription: InspectableSubscription) => CallbackReturnType;

/**
 * Represents a subscription to a stream-like source with enhanced inspection capabilities.
 */
export type Subscription = {
  /** A boolean flag indicating whether the subscription has been terminated */
  readonly unsubscribed: boolean;
  /** Terminates the subscription and any associated listening process */
  unsubscribe(): CallbackReturnType;
};

/**
 * Global subscription registry for pipeline-wide subscription management and inspection.
 */
class SubscriptionRegistry {
  private static instance: SubscriptionRegistry;
  private subscriptions = new Map<string, InspectableSubscription>();
  private globalHooks: SubscriptionInspectionHook[] = [];

  static getInstance(): SubscriptionRegistry {
    if (!SubscriptionRegistry.instance) {
      SubscriptionRegistry.instance = new SubscriptionRegistry();
    }
    return SubscriptionRegistry.instance;
  }

  register(subscription: InspectableSubscription): void {
    this.subscriptions.set(subscription.subscriptionId, subscription);
  }

  unregister(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  addGlobalHook(hook: SubscriptionInspectionHook): void {
    this.globalHooks.push(hook);
  }

  removeGlobalHook(hook: SubscriptionInspectionHook): void {
    const index = this.globalHooks.indexOf(hook);
    if (index > -1) {
      this.globalHooks.splice(index, 1);
    }
  }

  getGlobalHooks(): ReadonlyArray<SubscriptionInspectionHook> {
    return [...this.globalHooks];
  }

  getAllSubscriptions(): ReadonlyArray<InspectableSubscription> {
    return [...this.subscriptions.values()];
  }

  getActiveSubscriptions(): ReadonlyArray<InspectableSubscription> {
    return [...this.subscriptions.values()].filter(sub => sub.state === SubscriptionState.ACTIVE);
  }

  getSubscriptionsByStream(streamId: string): ReadonlyArray<InspectableSubscription> {
    return [...this.subscriptions.values()].filter(sub => sub.streamContext?.streamId === streamId);
  }

  getAggregatedStats(): {
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalValuesReceived: number;
    totalErrorsReceived: number;
    averageSubscriptionDuration: number;
  } {
    const subscriptions = [...this.subscriptions.values()];
    const stats = subscriptions.map(sub => sub.getStats());

    return {
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: stats.filter(s => s.state === SubscriptionState.ACTIVE).length,
      totalValuesReceived: stats.reduce((sum, s) => sum + s.valuesReceived, 0),
      totalErrorsReceived: stats.reduce((sum, s) => sum + s.errorsReceived, 0),
      averageSubscriptionDuration: stats.length > 0
        ? stats.reduce((sum, s) => sum + s.duration, 0) / stats.length
        : 0
    };
  }
}

/**
 * Creates a new subscription with comprehensive inspection capabilities.
 * Integrates with the existing context management and flow logging system.
 */
export function createInspectableSubscription(
  onUnsubscribe?: () => CallbackReturnType,
  streamContext?: StreamContext,
  options: {
    enableInspection?: boolean;
    subscriptionId?: string;
    metadata?: Record<string, any>;
  } = {}
): InspectableSubscription {
  const {
    enableInspection = true,
    subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    metadata = {}
  } = options;

  let state = SubscriptionState.CREATED;
  let _unsubscribing = false;
  let _unsubscribed = false;

  const events: SubscriptionEvent[] = [];
  const inspectionHooks: SubscriptionInspectionHook[] = [];
  const startTime = performance.now();

  let valuesReceived = 0;
  let errorsReceived = 0;
  let lastEmissionTime = 0;
  let totalEmissionInterval = 0;

  // Register with global registry if inspection is enabled
  const registry = enableInspection ? SubscriptionRegistry.getInstance() : null;

  /**
   * Log a subscription lifecycle event with flow integration.
   */
  const logEvent = (
    eventType: SubscriptionEvent['event'],
    newState: SubscriptionState,
    eventData: { value?: any; error?: any; metadata?: Record<string, any> } = {}
  ) => {
    const event: SubscriptionEvent = {
      subscriptionId,
      timestamp: performance.now(),
      event: eventType,
      state: newState,
      streamId: streamContext?.streamId,
      ...eventData,
      metadata: { ...metadata, ...eventData.metadata }
    };

    events.push(event);
    state = newState;

    // Integrate with existing flow logging system
    if (streamContext?.pipeline.flowLoggingEnabled) {
      const emoji = {
        created: '🆕',
        activated: '▶️',
        value_received: '📦',
        error_received: '💥',
        completed: '🏁',
        unsubscribing: '⏹️',
        unsubscribed: '🛑'
      }[eventType];

      console.log(
        `${emoji} [SUBSCRIPTION] ${subscriptionId} (${streamContext.streamId}): ${eventType}`,
        eventData.value ?? eventData.error ?? '',
        event.metadata ? `- ${JSON.stringify(event.metadata)}` : ''
      );
    }

    // Execute inspection hooks
    const allHooks = [...inspectionHooks, ...(registry?.getGlobalHooks() ?? [])];
    allHooks.forEach(hook => {
      try {
        hook(event, subscription);
      } catch (error) {
        console.warn(`Subscription inspection hook failed:`, error);
      }
    });

    // Update stream context if available
    if (streamContext && eventType === 'value_received') {
      streamContext.logFlow('resolved',
        { name: 'subscription' } as any,
        eventData.value,
        'received by subscription'
      );
    }
  };

  const unsubscribe = async (): Promise<void> => {
    if (!_unsubscribing && state !== SubscriptionState.UNSUBSCRIBED) {
      _unsubscribing = true;
      logEvent('unsubscribing', SubscriptionState.UNSUBSCRIBING);

      try {
        await onUnsubscribe?.();
        _unsubscribed = true;
        logEvent('unsubscribed', SubscriptionState.UNSUBSCRIBED);
      } catch (err) {
        logEvent('unsubscribed', SubscriptionState.ERROR, {
          error: err,
          metadata: { unsubscribeError: true }
        });
        console.error("Error during unsubscribe callback:", err);
      } finally {
        registry?.unregister(subscriptionId);
      }
    }
  };

  const getStats = (): SubscriptionStats => ({
    subscriptionId,
    streamId: streamContext?.streamId,
    state,
    valuesReceived,
    errorsReceived,
    duration: performance.now() - startTime,
    averageEmissionInterval: valuesReceived > 1
      ? totalEmissionInterval / (valuesReceived - 1)
      : undefined,
    hasActiveListeners: state === SubscriptionState.ACTIVE && !_unsubscribed
  });

  const addInspectionHook = (hook: SubscriptionInspectionHook) => {
    inspectionHooks.push(hook);
  };

  const removeInspectionHook = (hook: SubscriptionInspectionHook) => {
    const index = inspectionHooks.indexOf(hook);
    if (index > -1) {
      inspectionHooks.splice(index, 1);
    }
  };

  const subscription: InspectableSubscription = {
    subscriptionId,
    streamContext,
    events,
    get state() { return state; },
    get unsubscribed() { return _unsubscribed; },
    unsubscribe,
    getStats,
    addInspectionHook,
    removeInspectionHook
  };

  // Log creation and register
  logEvent('created', SubscriptionState.CREATED, { metadata });
  registry?.register(subscription);

  // Add methods for external state updates (used by stream implementations)
  (subscription as any)._activate = () => {
    logEvent('activated', SubscriptionState.ACTIVE);
  };

  (subscription as any)._onValue = (value: any) => {
    valuesReceived++;
    const now = performance.now();
    if (lastEmissionTime > 0) {
      totalEmissionInterval += (now - lastEmissionTime);
    }
    lastEmissionTime = now;
    logEvent('value_received', state, { value });
  };

  (subscription as any)._onError = (error: any) => {
    errorsReceived++;
    logEvent('error_received', SubscriptionState.ERROR, { error });
  };

  (subscription as any)._onComplete = () => {
    logEvent('completed', state);
  };

  return subscription;
}

/**
 * Creates a basic subscription (legacy compatibility).
 */
export function createSubscription(
  onUnsubscribe?: () => CallbackReturnType
): Subscription {
  const inspectable = createInspectableSubscription(onUnsubscribe, undefined, {
    enableInspection: false
  });

  return {
    get unsubscribed() { return inspectable.unsubscribed; },
    unsubscribe: inspectable.unsubscribe
  };
}

/**
 * Utility functions for subscription inspection and monitoring.
 */
export const SubscriptionInspector = {
  /**
   * Get the global subscription registry for pipeline-wide inspection.
   */
  getRegistry(): SubscriptionRegistry {
    return SubscriptionRegistry.getInstance();
  },

  /**
   * Add a global inspection hook that applies to all subscriptions.
   */
  addGlobalHook(hook: SubscriptionInspectionHook): void {
    SubscriptionRegistry.getInstance().addGlobalHook(hook);
  },

  /**
   * Create a performance monitoring hook.
   */
  createPerformanceHook(thresholds: {
    slowEmissionMs?: number;
    maxValuesPerSecond?: number;
  } = {}): SubscriptionInspectionHook {
    const { slowEmissionMs = 1000, maxValuesPerSecond = 100 } = thresholds;

    return (event, subscription) => {
      if (event.event === 'value_received') {
        const stats = subscription.getStats();

        // Check for slow emissions
        if (stats.averageEmissionInterval && stats.averageEmissionInterval > slowEmissionMs) {
          console.warn(`Slow emission detected in subscription ${subscription.subscriptionId}: ${stats.averageEmissionInterval}ms average interval`);
        }

        // Check for high frequency emissions
        const valuesPerSecond = stats.valuesReceived / (stats.duration / 1000);
        if (valuesPerSecond > maxValuesPerSecond) {
          console.warn(`High frequency emissions in subscription ${subscription.subscriptionId}: ${valuesPerSecond.toFixed(2)} values/sec`);
        }
      }
    };
  },

  /**
   * Create a memory monitoring hook.
   */
  createMemoryHook(): SubscriptionInspectionHook {
    return (event, subscription) => {
      if (typeof (performance as any).memory !== 'undefined') {
        const memory = (performance as any).memory;
        const memoryUsed = memory.usedJSHeapSize / (1024 * 1024); // Convert to MB

        if (event.event === 'value_received' && memoryUsed > 100) {
          console.warn(`High memory usage detected: ${memoryUsed.toFixed(2)}MB during subscription ${subscription.subscriptionId}`);
        }
      }
    };
  },

  /**
   * Export subscription timeline data for external analysis.
   */
  exportTimeline(subscriptionId: string, format: 'json' | 'csv' = 'json'): string {
    const registry = SubscriptionRegistry.getInstance();
    const subscription = registry.getAllSubscriptions().find(s => s.subscriptionId === subscriptionId);

    if (!subscription) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    if (format === 'json') {
      return JSON.stringify(subscription.events, null, 2);
    } else {
      const headers = ['timestamp', 'event', 'state', 'streamId', 'value', 'error'];
      const rows = subscription.events.map(event => [
        event.timestamp,
        event.event,
        event.state,
        event.streamId || '',
        JSON.stringify(event.value || ''),
        JSON.stringify(event.error || '')
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
  },

  /**
   * Generate a comprehensive report of all subscription activity.
   */
  generateReport(): {
    summary: ReturnType<SubscriptionRegistry['getAggregatedStats']>;
    subscriptions: SubscriptionStats[];
    timeline: SubscriptionEvent[];
  } {
    const registry = SubscriptionRegistry.getInstance();
    const subscriptions = registry.getAllSubscriptions();

    return {
      summary: registry.getAggregatedStats(),
      subscriptions: subscriptions.map(s => s.getStats()),
      timeline: subscriptions.flatMap(s => [...s.events]).sort((a, b) => a.timestamp - b.timestamp)
    };
  }
};
