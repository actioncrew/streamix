import { createSubject, Subject } from '@actioncrew/streamix';
import { EventEmitter } from '@angular/core';

class StreamixEventEmitter<T> {
  private stream: Subject<T>;

  constructor() {
    this.stream = createSubject();
  }

  emit(value: T) {
    this.stream.next(value);
  }

  subscribe(callback: (value: T) => void) {
    return this.stream.subscribe(value => callback(value));
  }
}

// Patch Angular's EventEmitter
Object.defineProperty(EventEmitter, 'prototype', {
  value: StreamixEventEmitter.prototype,
});
