import { fromEvent } from '@actioncrew/streamix';
import { describeBrowser } from './env-spec';

describeBrowser('fromEvent function', () => {
  it('should emit events from the element', (done) => {
    // Create a mock HTMLElement
    const element = document.createElement('button');

    // Create an event stream for 'click' events
    const stream = fromEvent(element, 'click');

    const emittedEvents: Event[] = [];

    const subscription = stream.subscribe({
      next: (value: Event) => {
        emittedEvents.push(value);

        // After 2 clicks, we can assert & clean up
        if (emittedEvents.length === 2) {
          expect(emittedEvents.length).toBe(2);
          subscription.unsubscribe(); // cleanup
          done();
        }
      },
      error: (err) => done.fail(err),
    });

    // Simulate click events
    element.click();
    element.click();
    subscription.unsubscribe();
  });
});
