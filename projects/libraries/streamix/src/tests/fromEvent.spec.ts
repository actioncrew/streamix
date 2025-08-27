import { fromEvent } from '@actioncrew/streamix';

xdescribe('fromEvent function', () => {
  it('should emit events from the element', (done) => {
    // Create a mock HTMLElement
    const element = document.createElement('button');

    // Create an event stream for 'click' events
    const stream = fromEvent(element, 'click');

    let emittedEvents: Event[] = [];
    const subscription = stream.subscribe({
      next: (value: any) => emittedEvents.push(value),
      complete: () => {
        expect(emittedEvents.length).toBe(2); // Check that two click events were emitted
        done();
      }
    });

    // Simulate click events
    element.click();
    element.click();
    subscription.unsubscribe();
  });
});
