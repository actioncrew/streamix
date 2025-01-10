import { observeMutation } from '../lib';

// Mock DOM element for testing purposes
let observedElement: HTMLDivElement;

describe('fromMutation Stream Tests', () => {
  beforeEach(() => {
    // Create a DOM element for testing
    observedElement = document.createElement('div');
    document.body.appendChild(observedElement); // Attach to DOM
  });

  afterEach(() => {
    // Cleanup after each test
    document.body.removeChild(observedElement);
  });

  test('should emit mutations when child is added', (done) => {
    const mutationStream = observeMutation(observedElement, {
      childList: true,
    });

    const subscription = mutationStream({
      next: (mutations) => {
        expect(mutations.length).toBeGreaterThan(0);
        expect(mutations[0].type).toBe('childList');
        expect(mutations[0].addedNodes.length).toBe(1);
        subscription.unsubscribe();
        done();
      },
    });

    // Trigger DOM change
    setTimeout(() => {
      const newDiv = document.createElement('div');
      newDiv.innerText = 'Child div added';
      observedElement.appendChild(newDiv);
    }, 100)
  });

  test('should emit mutations when child is removed', (done) => {
    const child = document.createElement('div');
    child.innerText = 'Child div to remove';
    observedElement.appendChild(child);

    const mutationStream = observeMutation(observedElement, {
      childList: true,
    });

    const subscription = mutationStream({
      next: (mutations) => {
        expect(mutations.length).toBeGreaterThan(0);
        expect(mutations[0].type).toBe('childList');
        expect(mutations[0].removedNodes.length).toBe(1);
        subscription.unsubscribe();
        done();
      },
    });

    // Trigger DOM change
    setTimeout(() => {
      observedElement.removeChild(child);
    }, 100)
  });

  test('should detect subtree changes', (done) => {
    const nestedParent = document.createElement('div');
    observedElement.appendChild(nestedParent);

    const nestedChild = document.createElement('div');
    nestedChild.innerText = 'Nested change';
    nestedParent.appendChild(nestedChild);

    const mutationStream = observeMutation(observedElement, {
      subtree: true,
      childList: true,
    });

    const subscription = mutationStream({
      next: (mutations) => {
        console.log('Mutations observed:', mutations);
        try {
          expect(mutations).toHaveLength(1);
          expect(mutations[0].type).toBe('childList');
          expect(mutations[0].addedNodes.length).toBe(1);
          subscription.unsubscribe();
          done();
        } catch (error: any) {
          done.fail(error);
        }
      },
    });

    // Wait until the DOM mutation happens AFTER observer is initialized
    setTimeout(() => {
      const newChild = document.createElement('div');
      newChild.innerText = 'Child added dynamically';
      nestedParent.appendChild(newChild);
    }, 100);
  });
});
