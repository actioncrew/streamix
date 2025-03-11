import { onIntersection } from '../lib';

// Set up Jest environment with jsdom
let testContainer: any;

beforeAll(() => {
  // Create a dedicated test container to avoid modifying the body directly
  testContainer = document.createElement('div');
  testContainer.style.height = '1000px';
  document.body.appendChild(testContainer);
});

afterEach(() => {
  // Remove only the test container's children to preserve the body
  testContainer.innerHTML = '';
});

xdescribe('Functional tests for fromIntersectionObserver', () => {
  let element: any;
  let visibilityStream;

  test('should emit true when element is visible', (done) => {
    element = document.createElement('div');
    Object.assign(element.style, {
      height: '100px',
      width: '100px',
      background: 'red',
      position: 'absolute',
      top: '500px'
    });
    testContainer.appendChild(element);

    visibilityStream = onIntersection(element);
    const emittedValues: any[] = [];
    const subscription = visibilityStream.subscribe({
      next: (isVisible) => emittedValues.push(isVisible),
      complete: () => console.log('hurra')
    });

    setTimeout(() => {
      expect(emittedValues).toContain(true);
      testContainer.removeChild(element);
      subscription.unsubscribe();
      done();
    }, 100);
  });

  test('should emit false when element is scrolled out of view', async () => {
    element = document.createElement('div');
    Object.assign(element.style, {
      height: '100px',
      width: '100px',
      background: 'blue',
      position: 'absolute',
      top: '-100px'
    });
    testContainer.appendChild(element);

    visibilityStream = onIntersection(element);
    const emittedValues: any[] = [];
    const subscription = visibilityStream.subscribe({
      next: (isVisible) => emittedValues.push(isVisible)
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(emittedValues).toContain(false);

    testContainer.removeChild(element);
    subscription.unsubscribe();
  });

  test('should properly clean up observer when element is removed', async () => {
    element = document.createElement('div');
    Object.assign(element.style, {
      height: '100px',
      width: '100px',
      background: 'green',
      position: 'absolute',
      top: '500px'
    });
    testContainer.appendChild(element);

    visibilityStream = onIntersection(element);
    const subscription = visibilityStream.subscribe(() => {});

    await new Promise((resolve) => setTimeout(resolve, 100));
    testContainer.removeChild(element);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(visibilityStream.completed()).toBe(true);
    subscription.unsubscribe();
  });
});
