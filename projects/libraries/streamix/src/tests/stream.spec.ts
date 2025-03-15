// stream.spec.ts
import { createBehaviorSubject, createReplaySubject, createStream, createSubject } from '../lib';

describe('Streamix Streams and Subjects', () => {

  it('should emit values in sequence (basic stream)', (done) => {
    const stream = createStream<number>("test", async function* () {
      yield 1;
      yield 2;
      yield 3;
    });

    const received: number[] = [];

    (async () => {
      for await (const value of stream) {
        received.push(value);
      }
      expect(received).toEqual([1, 2, 3]);
      done();
    })();
  });

  it('should support multiple subscriptions to the same stream', (done) => {
    const stream = createStream<number>("test", async function* () {
      yield 1;
      yield 2;
      yield 3;
    });

    const received1: number[] = [];
    const received2: number[] = [];

    const subscription1 = (async () => {
      for await (const value of stream) {
        received1.push(value);
      }
    })();

    const subscription2 = (async () => {
      for await (const value of stream) {
        received2.push(value);
      }
    })();

    Promise.all([subscription1, subscription2]).then(() => {
      expect(received1).toEqual([1, 2, 3]);
      expect(received2).toEqual([1, 2, 3]);
      done();
    });
  });


  it('should multicast values with Subject', (done) => {
    const subject = createSubject<number>();

    const received1: number[] = [];
    const received2: number[] = [];

    subject.subscribe(value => received1.push(value));
    subject.subscribe(value => received2.push(value));

    subject.next(1);
    subject.next(2);
    subject.next(3);

    expect(received1).toEqual([1, 2, 3]);
    expect(received2).toEqual([1, 2, 3]);

    done();
  });

  it('should replay the last value with BehaviorSubject', (done) => {
    const behaviorSubject = createBehaviorSubject(0); // Initial value

    const received1: number[] = [];
    behaviorSubject.subscribe(value => received1.push(value));

    behaviorSubject.next(1);
    behaviorSubject.next(2);

    const received2: number[] = [];
    behaviorSubject.subscribe(value => received2.push(value));

    behaviorSubject.next(3);

    expect(received1).toEqual([0, 1, 2, 3]); // First subscriber gets all
    expect(received2).toEqual([2, 3]); // Second subscriber gets last + new

    done();
  });

  it('should replay all values with ReplaySubject', (done) => {
    const replaySubject = createReplaySubject<number>();

    replaySubject.next(1);
    replaySubject.next(2);
    replaySubject.next(3);

    const received: number[] = [];
    replaySubject.subscribe(value => received.push(value));

    replaySubject.next(4);

    expect(received).toEqual([1, 2, 3, 4]); // New subscriber gets all previous + new

    done();
  });

  it('should handle multiple subscriptions', (done) => {
    const subject = createSubject<number>();

    const received1: number[] = [];
    const received2: number[] = [];

    const sub1 = subject.subscribe(value => received1.push(value));
    subject.next(1);
    subject.next(2);

    const sub2 = subject.subscribe(value => received2.push(value));
    subject.next(3);

    expect(received1).toEqual([1, 2, 3]);
    expect(received2).toEqual([3]); // Second subscriber only gets new values

    sub1.unsubscribe();
    sub2.unsubscribe();

    done();
  });
});
