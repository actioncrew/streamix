import { fromEvent } from '@actioncrew/streamix';
import { idescribe } from './env.spec';

idescribe('fromEvent', () => {

  it('should call the overridden subscribe method', (done) => {
    const element = document.createElement('button');
    const stream = fromEvent(element, 'click');

    const subscription = stream.subscribe((ev) => {
      expect(ev).toBeInstanceOf(Event);
      done();
    });

    // Trigger the listener
    element.click();
    subscription.unsubscribe(); // trigger cleanup
});

  it('should emit multiple events correctly', (done) => {
    const element = document.createElement('button');
    const stream = fromEvent(element, 'click');

    const emitted: Event[] = [];
    const subscription = stream.subscribe((ev) => {
      emitted.push(ev);
      if (emitted.length === 2) {
        expect(emitted.length).toBe(2);
        done();
      }
    });

    element.click();
    element.click();
    subscription.unsubscribe(); // trigger cleanup
  });

  it('should remove event listener and unsubscribe on unsubscribe', (done) => {
    const element = document.createElement('button');
    const stream = fromEvent(element, 'click');

    let listenerRemoved = false;

    // Monkey-patch for testing cleanup
    const originalRemove = element.removeEventListener;
    element.removeEventListener = function (...args: any[]) {
      listenerRemoved = true;
      return originalRemove.apply(this, args as any);
    };

    const subscription = stream.subscribe();

    subscription.unsubscribe();

    setTimeout(() => {
      expect(listenerRemoved).toBe(true);
      done();
    }, 10);
  });

  it('should not emit events after unsubscribe', (done) => {
    const element = document.createElement('button');
    const stream = fromEvent(element, 'click');

    let count = 0;
    const subscription = stream.subscribe(() => count++);

    element.click();          // first event should increment count
    subscription.unsubscribe();
    element.click();          // second event should be ignored

    setTimeout(() => {
      expect(count).toBe(1);
      done();
    }, 10);
  });

});
