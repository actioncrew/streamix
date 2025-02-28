import { EventEmitter } from '@angular/core';
import { Stream } from 'streamix';

class StreamixEventEmitter<T> {
  private stream: Stream<T>;

  constructor() {
    this.stream = (emission) => {};
  }

  emit(value: T) {
    this.stream({ value });
  }

  subscribe(callback: (value: T) => void) {
    return this.stream.forward(({ value }) => callback(value));
  }
}

// Patch Angular's EventEmitter
Object.defineProperty(EventEmitter, 'prototype', {
  value: StreamixEventEmitter.prototype,
});
