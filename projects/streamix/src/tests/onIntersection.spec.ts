import { onIntersection } from '../lib';

describe('Functional tests for fromIntersectionObserver', () => {
    let element: HTMLElement;
    let visibilityStream: any;
    let testContainer: HTMLElement;

    beforeEach(() => {
        // Create a test container for each test
        testContainer = document.createElement('div');
        document.body.appendChild(testContainer);
    });

    afterEach(() => {
        // Clean up the test container after each test
        if (testContainer && document.body.contains(testContainer)) {
            document.body.removeChild(testContainer);
        }
    });

    it('should emit true when element is visible', (done) => {
        element = document.createElement('div');
        element.style.height = '100px';
        element.style.width = '100px';
        element.style.background = 'red';
        element.style.position = 'absolute';
        element.style.top = '500px';

        testContainer.appendChild(element);

        visibilityStream = onIntersection(element);

        const emittedValues: boolean[] = [];
        const subscription = visibilityStream.subscribe({
            next: (isVisible: boolean) => {
                emittedValues.push(isVisible);
            },
            complete: () => {
                expect(emittedValues).toContain(true);
                done();
            }
        });

        // Wait a moment to let IntersectionObserver detect visibility
        setTimeout(() => {
            // Cleanup DOM
            testContainer.removeChild(element);
            subscription.unsubscribe();
        }, 100);
    });
});
