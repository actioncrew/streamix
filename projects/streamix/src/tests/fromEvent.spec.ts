import { fromEvent } from '../lib';

describe('fromEvent function', () => {
  it('should emit events from the element', (done) => {
    // Create a mock HTMLElement
    const element = document.createElement('button');

    // Create an event stream for 'click' events
    const stream = fromEvent(element, 'click');

    let emittedEvents: Event[] = [];
    const subscription = stream.subscribe((event) => {
      emittedEvents.push(event.value);
    });

    // Simulate click events
    stream.isRunning.promise.then(() => {
      element.click();
      element.click();
      stream.complete();
    });

    // Wait for events to be processed
    stream.isStopped.then(() => {
      expect(emittedEvents.length).toBe(2); // Check that two click events were emitted

      subscription.unsubscribe();
      done();
    });
  });
});
