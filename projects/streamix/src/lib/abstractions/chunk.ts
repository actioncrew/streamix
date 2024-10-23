import { Pipeline, Stream } from '../abstractions';
import { hook, PromisifiedType } from '../utils';
import { Emission } from './emission';
import { isOperatorType, OperatorType } from './operator';
import { Subscribable } from './subscribable';

export class Chunk<T = any> extends Stream<T> implements Subscribable<T> {
  operators: OperatorType[] = [];
  head: OperatorType | undefined;
  tail: OperatorType | undefined;

  constructor(public stream: Stream<T>) {
    super();
    Object.assign(this, stream);
    this.subscribers = hook();
    this.onEmission = hook();
  }

  override get isAutoComplete() {
    return this.stream.isAutoComplete;
  }

  override set isAutoComplete(value: boolean) {
    this.stream.isAutoComplete = value;
  }

  override get isStopRequested() {
    return this.stream.isStopRequested;
  }

  override set isStopRequested(value: boolean) {
    this.stream.isStopRequested = value;
  }

  override get isRunning() {
    return this.stream.isRunning;
  }

  override set isRunning(value: boolean) {
    this.stream.isRunning = value;
  }

  override get isStopped() {
    return this.stream.isStopped;
  }

  override set isStopped(value: boolean) {
    this.stream.isStopped = value;
  }

  override init() {
    if (!this.stream.onEmission.contains(this, this.emit)) {
      this.stream.onEmission.chain(this, this.emit);
    }
  }

  override start() {
    return this.stream.startWithContext(this);
  }

  override async cleanup() {
    this.stream.onEmission.remove(this, this.emit);
  }

  override run(): Promise<void> {
    return this.stream.run();
  }

  override pipe(...operators: OperatorType[]): Subscribable<T> {
    return new Pipeline<T>(this.stream.clone()).pipe(...this.operators, ...operators);
  }

  bindOperators(...operators: OperatorType[]): Subscribable<T> {
    this.operators = []; this.head = undefined; this.tail = undefined;

    operators.forEach((operator, index) => {
      this.operators.push(operator);

      if (!this.head) {
        this.head = operator;
      } else {
        this.tail!.next = operator;
      }
      this.tail = operator;

      if ('stream' in operator && index !== operators.length - 1) {
        throw new Error("Only the last operator in a chunk can contain outerStream property.");
      }
    });

    return this;
  }

  override async emit({ emission, source }: { emission: Emission; source: any }): Promise<void> {
    try {
      let next = (source instanceof Stream) ? this.head : undefined;
      next = isOperatorType(source) ? source.next : next;

      if(emission.isFailed) {
        throw emission.error;
      }

      if(!emission.isPhantom) {
        // Process the emission with the next operator, if any
        emission = await (next?.process(emission, this) ?? Promise.resolve(emission));
      }

      if(emission.isFailed) {
        throw emission.error;
      }
      // If emission is valid, notify subscribers
      if (!emission.isPhantom) {
        await this.onEmission.parallel({ emission, source: this });
        await this.subscribers.parallel(emission.value);
      }

      emission.isComplete = true;
    } catch (error: any) {
      emission.isFailed = true;
      emission.error = error;

      await this.onError.process({ error });
    }
  }

  override get value() {
    return this.stream.currentValue;
  }
}
