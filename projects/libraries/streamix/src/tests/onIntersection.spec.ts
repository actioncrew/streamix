import { onIntersection } from '@actioncrew/streamix';

xdescribe('Functional tests for fromIntersectionObserver', () => {
  let element: HTMLElement;
  let visibilityStream: any;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
  });

  afterEach(() => {
    if (element && element.parentNode) {
      document.body.removeChild(element);
    }
    if (visibilityStream && visibilityStream.unsubscribe) {
        visibilityStream.unsubscribe();
    }
  });

  it('should emit true when element is visible', (done) => {
    element.style.height = '100px';
    element.style.width = '100px';
    element.style.background = 'red';
    element.style.position = 'absolute';
    element.style.top = '500px';

    visibilityStream = onIntersection(element);

    const emittedValues: boolean[] = [];
    const subscription = visibilityStream.subscribe({
      next: (isVisible: boolean) => {
        emittedValues.push(isVisible);
      },
      complete: () => {
        subscription.unsubscribe();
      }
    });

    setTimeout(() => {
      expect(emittedValues).toContain(true);
      done();
    }, 100);
  });

  it('should emit false when element is scrolled out of view', async () => {
    element.style.height = '100px';
    element.style.width = '100px';
    element.style.background = 'blue';
    element.style.position = 'absolute';
    element.style.top = '-100px';

    visibilityStream = onIntersection(element);

    const emittedValues: boolean[] = [];
    visibilityStream.subscribe({
      next: (isVisible: boolean) => {
        emittedValues.push(isVisible);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(emittedValues).toContain(false);
  });

  it('should properly clean up observer when element is removed', async () => {
    element.style.height = '100px';
    element.style.width = '100px';
    element.style.background = 'green';
    element.style.position = 'absolute';
    element.style.top = '500px';

    visibilityStream = onIntersection(element);

    const subscription = visibilityStream.subscribe(()=>{});

    await new Promise((resolve) => setTimeout(resolve, 100));

    document.body.removeChild(element);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(subscription.closed).toBe(true);
  });
});
