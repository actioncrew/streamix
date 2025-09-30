import { Stream, onMediaQuery } from '@actioncrew/streamix';
import { idescribe } from './env.spec';

idescribe('onMediaQuery', () => {
  let mqlMap: Record<string, any> = {};

  beforeEach(() => {
    mqlMap = {};

    // Mock window.matchMedia
    (window as any).matchMedia = jasmine.createSpy('matchMedia').and.callFake((query: string) => {
      if (!mqlMap[query]) {
        const listeners: ((event: MediaQueryListEvent) => void)[] = [];
        mqlMap[query] = {
          matches: false,
          media: query,
          addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
          removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
            const index = listeners.indexOf(cb);
            if (index >= 0) listeners.splice(index, 1);
          },
          // Helper to manually dispatch events
          dispatchEvent: (matches: boolean) => {
            mqlMap[query].matches = matches;
            listeners.forEach(cb => cb({ matches } as MediaQueryListEvent));
          },
          listeners,
        };
      }
      return mqlMap[query];
    });
  });

  it('should emit initial value immediately', async () => {
    const stream: Stream<boolean> = onMediaQuery('(min-width: 600px)');
    const callback = jasmine.createSpy('callback');

    stream.subscribe(callback);

    // Wait for async emission
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(callback).toHaveBeenCalledWith(false);
  });

  it('should call callback on media query change', async () => {
    const query = '(min-width: 600px)';
    const stream: Stream<boolean> = onMediaQuery(query);
    const callback = jasmine.createSpy('callback');
    stream.subscribe(callback);

    // Wait for initial emission
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(callback).toHaveBeenCalledWith(false);

    const mql = mqlMap[query];

    // Dispatch change event
    mql.dispatchEvent(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(callback).toHaveBeenCalledWith(true);

    mql.dispatchEvent(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(callback).toHaveBeenCalledWith(false);

    expect(callback).toHaveBeenCalledTimes(3); // initial + 2 changes
  });

  it('should clean up listener on unsubscribe', async () => {
    const query = '(min-width: 600px)';
    const stream: Stream<boolean> = onMediaQuery(query);
    const callback = jasmine.createSpy('callback');

    const subscription = stream.subscribe(callback);
    
    // Wait for initial emission
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const mql = mqlMap[query];
    expect(mql.listeners.length).toBe(1);

    subscription.unsubscribe();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(mql.listeners.length).toBe(0);
  });

  it('should warn if matchMedia is not supported', () => {
    (window as any).matchMedia = undefined;
    spyOn(console, 'warn');

    const stream: Stream<boolean> = onMediaQuery('(min-width: 600px)');
    expect(console.warn).toHaveBeenCalledWith('matchMedia is not supported in this environment');

    const callback = jasmine.createSpy('callback');
    stream.subscribe(callback);

    expect(callback).not.toHaveBeenCalled();
  });
});