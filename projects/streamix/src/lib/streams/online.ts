import { createEmission, createStream, eventBus, flags, hooks, internals } from '../abstractions';

/**
 * Creates a Stream that listens for online/offline status changes using
 * `window.navigator.onLine` and the `online`/`offline` browser events.
 * Emits boolean values representing online or offline state.
 *
 * @returns A reactive Stream that emits boolean values on online/offline state changes.
 *
 * @example
 * const onlineStream = online();
 * onlineStream.subscribe({
 *   next: (isOnline) => console.log('Online status changed: ', isOnline),
 * });
 */
export function fromOnline() {
  const stream = createStream<boolean>(async function (this: any) {
    if (typeof window === 'undefined' || !window.navigator?.onLine) {
      throw new Error('Online/Offline status is unsupported on this browser');
    }

    const handleOnline = () => {
      eventBus.enqueue({
        target: this,
        payload: { emission: createEmission({ value: true }), source: this },
        type: 'emission',
      });
    };

    const handleOffline = () => {
      eventBus.enqueue({
        target: this,
        payload: { emission: createEmission({ value: false }), source: this },
        type: 'emission',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Emit initial online status when stream is initialized
    eventBus.enqueue({
      target: this,
      payload: { emission: createEmission({ value: window.navigator.onLine }), source: this },
      type: 'emission',
    });

    await this[internals].awaitCompletion();

    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });

  stream.name = 'online';
  return stream;
}
