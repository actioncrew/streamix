import { createReceiver } from '@actioncrew/streamix';

describe('createReceiver', () => {
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('should create a receiver from a function (next only)', async () => {
    const nextSpy = jasmine.createSpy('next');
    const receiver = createReceiver<number>(nextSpy);

    await receiver.next(42);

    expect(nextSpy).toHaveBeenCalledWith(42);
    expect(receiver.completed).toBeFalse();
  });

  it('should create a receiver from an object', async () => {
    const nextSpy = jasmine.createSpy('next');
    const errorSpy = jasmine.createSpy('error');
    const completeSpy = jasmine.createSpy('complete');

    const receiver = createReceiver<number>({
      next: nextSpy,
      error: errorSpy,
      complete: completeSpy
    });

    await receiver.next(1);
    await receiver.error(new Error('test'));
    await receiver.complete();

    expect(nextSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(jasmine.any(Error));
    expect(completeSpy).toHaveBeenCalled();
    expect(receiver.completed).toBeTrue();
  });

  it('should create a no-op receiver if no input is given', async () => {
    const receiver = createReceiver();

    await receiver.next('value');
    await receiver.error(new Error('err'));
    await receiver.complete();

    expect(receiver.completed).toBeTrue();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should not process events after completion', async () => {
    const nextSpy = jasmine.createSpy('next');
    const receiver = createReceiver<number>(nextSpy);

    await receiver.complete();
    await receiver.next(5);

    expect(nextSpy).not.toHaveBeenCalledWith(5);
    expect(receiver.completed).toBeTrue();
  });

  it('should forward errors thrown in next to error handler', async () => {
    const errorSpy = jasmine.createSpy('error');
    const receiver = createReceiver<number>({
      next: () => { throw new Error('boom'); },
      error: errorSpy
    });

    await receiver.next(123);

    expect(errorSpy).toHaveBeenCalledWith(jasmine.any(Error));
  });

  it('should log unhandled errors in error handler', async () => {
    const receiver = createReceiver<number>({
      next: () => { throw new Error('boom'); },
      error: () => { throw new Error('bad error handler'); }
    });

    await receiver.next(1);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unhandled error in error handler:',
      jasmine.any(Error)
    );
  });

  it('should log unhandled errors in complete handler', async () => {
    const receiver = createReceiver<number>({
      complete: () => { throw new Error('bad complete'); }
    });

    await receiver.complete();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unhandled error in complete handler:',
      jasmine.any(Error)
    );
  });

  it('should defer completion until after next finishes', async () => {
    const completeSpy = jasmine.createSpy('complete');
    let resolveNext: () => void;

    const receiver = createReceiver<number>({
      next: () => new Promise<void>((resolve) => { resolveNext = resolve; }),
      complete: completeSpy
    });

    // Call next (processing starts)
    const nextPromise = receiver.next(99);

    // Call complete while still processing
    const completePromise = receiver.complete();

    // Not completed yet
    expect(receiver.completed).toBeFalse();
    expect(completeSpy).not.toHaveBeenCalled();

    // Finish next
    resolveNext!();
    await nextPromise;
    await completePromise;

    expect(receiver.completed).toBeTrue();
    expect(completeSpy).toHaveBeenCalled();
  });
});
