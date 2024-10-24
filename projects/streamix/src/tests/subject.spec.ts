import { Subject } from '../lib';

describe('Subject', () => {
  it('should emit values to subscribers', async () => {
    const subject = new Subject<any>();

    const emittedValues: any[] = [];
    const subscription = subject.subscribe(value => {
      emittedValues.push(value);
    });

    subject.next('value1');
    subject.next('value2');
    subject.complete();

    subject.onStop.once(() => {
      expect(emittedValues).toEqual(['value1', 'value2']);
      subscription.unsubscribe();
    })
  });

  it('should not emit values after unsubscribed', async () => {
    const subject = new Subject<any>();

    const emittedValues: any[] = [];
    const subscription = subject.subscribe(value => {
      emittedValues.push(value);
    });


    subject.next('value1');
    subscription.unsubscribe();
    subject.next('value2');

    subject.onStop.once(() => {
      expect(emittedValues).toEqual(['value1']);
      subscription.unsubscribe();
    })
  });

  it('should not emit values after stopped', async () => {
    const subject = new Subject<any>();

    const emittedValues: any[] = [];
    const subscription = subject.subscribe(value => {
      emittedValues.push(value);
    });

    subject.next('value1');
    subject.isStopRequested = true;
    subject.next('value2');

    subject.onStop.once(() => {
      expect(emittedValues).toEqual(['value1']);
      subscription.unsubscribe();
    })
  });

  it('should clear emission queue on cancel', async () => {
    const subject = new Subject<any>();

    const emittedValues: any[] = [];
    const subscription = subject.subscribe(value => {
      emittedValues.push(value);
    });

    subject.next('value1');
    subject.complete();
    subject.next('value2');

    subject.onStop.once(() => {
      expect(emittedValues).toEqual(['value1']);
      subscription.unsubscribe();
    })
  });

  it('should not allow pushing values to a stopped Subject', async () => {
    const subject = new Subject<any>();

    const emittedValues: any[] = [];
    const subscription = subject.subscribe(value => {
      emittedValues.push(value);
    });

    subject.isStopRequested = true;
    subject.next('value1');

    subject.onStop.once(() => {
      expect(emittedValues).toEqual([]);
      subscription.unsubscribe();
    })
  });
  it('stress test, synchronous case', async () => {
    const subject = new Subject<any>();

    let counter = 0;
    const subscription = subject.subscribe(value => {
      expect(value === counter++).toBeTruthy();
    });

    for (let i = 0; i < 10000; i++) {
      subject.next(i);
    }

    subject.complete();

    subject.onStop.once(() => {
      subscription.unsubscribe();
    })
  });

  it('stress test, asynchronous case', async () => {
    const subject = new Subject<any>();

    let counter = 0;
    const subscription = subject.subscribe(value => {
      expect(value === counter++).toBeTruthy();
    });

    subject.onStop.once(() => {
      subscription.unsubscribe();
    })

    for (let i = 0; i < 10000; i++) {
      await subject.next(i);
    }

    await subject.complete();
  });
});
