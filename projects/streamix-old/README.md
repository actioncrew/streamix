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

Streamix is a lightweight alternative to RxJS that implements reactive programming with a simplified concept of streams and emissions. If you're already familiar with RxJS, you’ll find Streamix easy to pick up, but with a fresh, minimalistic approach designed for modern, performance-oriented applications.

Streamix supports many core RxJS operators, along with unique tools designed to handle heavy computational tasks, including those leveraging the Web Workers API. It’s continuously evolving with new operators and features to meet the needs of modern developers.

## The Asynchronous Future
Today's development landscape revolves around asynchronous challenges: managing user interactions, network requests, and ensuring a responsive UI. In such a world, synchronous programming is a thing of the past, and async/await reigns supreme.

However, the complexity of asynchronous programming can sometimes feel overwhelming, especially for simple projects or specific use cases where lightweight, easy-to-understand tools are more suitable.

Streamix offers a simple, effective way to handle asynchronous data streams without the overhead of more advanced libraries like RxJS, while still maintaining robust features for dealing with async patterns.

## Key Concepts
- Stream: A sequence of values that can be observed. Streams can emit values either synchronously or asynchronously.
- Emission: The individual values emitted by a stream, along with metadata like whether the emission was canceled or if it encountered an error.
- Operator: Functions that transform, filter, or combine streams of data.
- Subject: A special type of stream that allows manually dispatching emissions. Subjects can also be used to share a single execution path among multiple subscribers.
- Bus: After experimenting with various approaches, we decided to use a bus to manage event flow across streams. This approach simplifies coordination and enhances stream management for more complex scenarios.

## Why Streamix?
Streamix is designed for those who need a straightforward way to manage asynchronous data without the complexity of larger frameworks. It's a great alternative to RxJS for simpler use cases, offering all the core functionality you need in a more lightweight, efficient package.

## Explore More
To see Streamix in action, check out these sample projects:
[Sample projects](https://github.com/actioncrew/streamix/)

Interested in extending Streamix or using it in your project? Reach out to us! We’re excited to collaborate and help bring your ideas to life.

[More information](https://medium.com/p/00d5467f0c01)

