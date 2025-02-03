# Streamix

```javascript
    const resize$ = fromEvent(window, 'resize').pipe(
      startWith(this.getCanvasSize()),
      map(() => this.getCanvasSize())
    );
```

  [![build status](https://github.com/actioncrew/streamix/workflows/build/badge.svg)](https://github.com/actioncrew/streamix/workflows/build/badge.svg)
  [![npm version](https://img.shields.io/npm/v/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
  [![npm downloads](https://img.shields.io/npm/dm/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
  [![min+zipped](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)

Streamix is a library for reactive programming designed to handle asynchronous data flows with clarity and performance.

Streamix is built for developers who want a simple, efficient way to manage asynchronous data streams, with minimal overhead and maximum flexibility. It supports a wide range of operators and powerful features for dealing with complex computational tasks, such as Web Workers, all while maintaining a lightweight footprint.

Streamix offers a simple, effective way to handle asynchronous data streams without the overhead of more advanced libraries like RxJS, while still maintaining robust features for dealing with async patterns.

## Key Concepts
- Stream: A sequence of values that can be observed. Streams can emit values either synchronously or asynchronously.
- Emission: The individual values emitted by a stream, along with metadata like whether the emission was canceled or if it encountered an error.
- Operator: Functions that transform, filter, or combine streams of data.
- Pipeline: A pipeline is a series of stream operators chained together to process data.
- Bus: An event bus to manage and coordinate stream emissions, simplifying complex interactions between multiple streams.

## Why Streamix?
Streamix is designed for those who need a straightforward way to manage asynchronous data without the complexity of larger frameworks. It's a great alternative to RxJS for simpler use cases, offering all the core functionality you need in a more lightweight, efficient package.

## Explore More
To see Streamix in action, check out these sample projects:
[Sample projects](https://github.com/actioncrew/streamix/)

Feel free to join the conversation on [GitHub](https://github.com/actioncrew/streamix/discussions)! We’re excited to collaborate and help bring your ideas to life.

[More information](https://medium.com/p/00d5467f0c01)

