import { map, onAnimationFrame, takeWhile } from '@actioncrew/streamix';
import { idescribe } from './env.spec';

idescribe('onAnimationFrame', () => {

  it('should emit values at the expected rate', async () => {
    let emittedValues: any[] = [];
    let count = 0;
    const stream = onAnimationFrame().pipe(
      map((_: any, index: any) => index),
      takeWhile(() => count < 5)
    );

    stream.subscribe({
      next: (value: any) => {
        count++;
        emittedValues.push(value);
      },
      complete: () => {
        console.log('Stream completed.');
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(emittedValues).toEqual([0, 1, 2, 3, 4]);
  });

  it('should stop when condition is met', (done) => {
    let emittedValues: any[] = [];
    let count = 0;
    const stream = onAnimationFrame().pipe(takeWhile(() => count < 50));

    const sub = stream.subscribe({
      next: (value: any) => {
        count++;
        emittedValues.push(value);
      },
      complete: () => {
        expect(emittedValues.length).toBe(50);
        expect(() => sub.unsubscribe()).not.toThrow(); // idempotent unsubscribe
        done();
      },
    });
  });

  it('should handle infinite loop when condition is always true', async () => {
    let emittedValues: any[] = [];
    let count = 0;
    const infiniteStream = onAnimationFrame().pipe(takeWhile(() => count <= 10));

    let subscription = infiniteStream.subscribe({
      next: (value: any) => {
        count++;
        emittedValues.push(value);
      },
      complete: () => {
        console.log('Infinite stream completed after 10 frames.');
        subscription.unsubscribe(); // redundant but safe
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(emittedValues.length).toBe(11);
    expect(emittedValues[0]).toBeLessThan(100);
    expect(emittedValues[10]).toBeLessThan(100);
  });

  it('should call unsubscribe callback and cancel animation frame', (done) => {
    // Spy on cancelAnimationFrame
    const originalCancel = globalThis.cancelAnimationFrame;
    const cancelSpy = jasmine.createSpy('cancelAnimationFrame');
    (globalThis as any).cancelAnimationFrame = cancelSpy;

    const stream = onAnimationFrame();
    const sub = stream.subscribe(() => {});

    // Wait a couple of frames
    setTimeout(() => {
      sub.unsubscribe();
      expect(cancelSpy).toHaveBeenCalled();
      // Restore original
      (globalThis as any).cancelAnimationFrame = originalCancel;
      done();
    }, 100);
  });

  it('should allow multiple independent subscribers', async () => {
    let valuesA: number[] = [];
    let valuesB: number[] = [];

    const stream = onAnimationFrame();

    const subA = stream.subscribe(v => valuesA.push(v));
    const subB = stream.subscribe(v => valuesB.push(v));

    await new Promise(res => setTimeout(res, 200));

    subA.unsubscribe();
    subB.unsubscribe();

    // Both subscribers should have received some frames
    expect(valuesA.length).toBeGreaterThan(0);
    expect(valuesB.length).toBeGreaterThan(0);
  });
});
