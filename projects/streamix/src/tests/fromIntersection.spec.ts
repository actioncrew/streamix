import { fromIntersection } from '../lib';

// Set up Jest environment with jsdom
beforeAll(() => {
  // Ensure the DOM environment is ready
  document.body.innerHTML = `<div style="height: 1000px;"></div>`;
});

afterEach(() => {
  document.body.innerHTML = ''; // Clean up DOM after each test
});

xdescribe('Functional tests for fromIntersectionObserver', () => {
  let element: HTMLElement;
  let visibilityStream: any;

  test('should emit true when element is visible', (done) => {
    element = document.createElement('div');
    element.style.height = '100px';
    element.style.width = '100px';
    element.style.background = 'red';
    element.style.position = 'absolute';
    element.style.top = '500px';

    document.body.appendChild(element);

    visibilityStream = fromIntersection(element);

    const emittedValues: boolean[] = [];
    const subscription = visibilityStream.subscribe({
      next: (isVisible: boolean) => {
        emittedValues.push(isVisible);
      },
      complete: () => console.log('hurra')
    });

    // Wait a moment to let IntersectionObserver detect visibility
    setTimeout(() => {
      expect(emittedValues).toContain(true);
      // Cleanup DOM
      document.body.removeChild(element);
      subscription.unsubscribe();
      done();
    }, 100);
  });

  test('should emit false when element is scrolled out of view', async () => {
    element = document.createElement('div');
    element.style.height = '100px';
    element.style.width = '100px';
    element.style.background = 'blue';
    element.style.position = 'absolute';
    element.style.top = '-100px'; // Element is off-screen by default

    document.body.appendChild(element);

    visibilityStream = fromIntersection(element);

    const emittedValues: boolean[] = [];
    const subscription = visibilityStream.subscribe({
      next: (isVisible: boolean) => {
        emittedValues.push(isVisible);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(emittedValues).toContain(false);

    // Cleanup DOM
    document.body.removeChild(element);
    subscription.unsubscribe();
  });

  test('should properly clean up observer when element is removed', async () => {
    element = document.createElement('div');
    element.style.height = '100px';
    element.style.width = '100px';
    element.style.background = 'green';
    element.style.position = 'absolute';
    element.style.top = '500px';

    document.body.appendChild(element);

    visibilityStream = fromIntersection(element);

    const subscription = visibilityStream.subscribe();

    // Wait for observer to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Remove the element
    document.body.removeChild(element);

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(subscription.closed).toBe(true);

    subscription.unsubscribe();
  });
});
