import { Receiver, Stream } from '../abstractions';
import { createSubject } from '../subjects';

/**
 * Creates a reactive stream that emits the time delta (in milliseconds) between
 * consecutive `requestAnimationFrame` calls.
 *
 * This stream provides a convenient way to track frame updates in animations,
 * game loops, or other time-sensitive operations. Each subscriber receives
 * a stream of `number` values representing the elapsed time since the previous frame.
 *
 * **Behavior:**
 * - When a subscriber subscribes, a new RAF loop starts immediately.
 * - The first emitted value is the delta between the first and second RAF callbacks.
 * - Each subsequent frame emits the delta since the previous frame.
 * - When the subscriber unsubscribes, the RAF loop is canceled to avoid unnecessary CPU usage.
 *
 * @returns {Stream<number>} A stream emitting the time delta between frames.
 */
export function onAnimationFrame(): Stream<number> {
  const subject = createSubject<number>();

  const originalSubscribe = subject.subscribe;
  subject.subscribe = (callback?: ((value: number) => void) | Receiver<number>) => {
    const subscription = originalSubscribe.call(subject, callback);

    let lastTime = performance.now();
    let rafId: number | null = null;

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      subject.next(delta);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const originalOnUnsubscribe = subscription.onUnsubscribe;
    subscription.onUnsubscribe = () => {
      originalOnUnsubscribe?.call(subscription);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      subscription.unsubscribe();
    };

    return subscription;
  };

  subject.name = 'onAnimationFrame';
  return subject;
}
