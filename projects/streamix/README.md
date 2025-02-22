<h1 style="display: none;">Streamix</h1>

<p align="center">
  <img src="https://github.com/actioncrew/streamix/blob/main/projects/streamix/LOGO.png?raw=true" alt="Streamix Logo" width="300">
</p>

Streamix is a **lightweight alternative to RxJS** that implements reactive programming with a simplified concept of streams and emissions. Designed for modern, performance-oriented applications, Streamix combines simplicity with an ultra-light footprint, weighing in at just **5 KB (zipped)**.

[![build status](https://github.com/actioncrew/streamix/workflows/build/badge.svg)](https://github.com/actioncrew/streamix/workflows/build/badge.svg)
[![npm version](https://img.shields.io/npm/v/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
[![npm downloads](https://img.shields.io/npm/dm/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
[![min+zipped](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)

---

## Why Streamix?

Streamix is designed for developers who need a **simple, lightweight solution** for managing asynchronous data streams. It provides many of the core features of RxJS but with a **minimalistic approach**, making it ideal for:

- Modern web applications.
- Performance-critical tasks.
- Projects where simplicity and small bundle size are priorities.

---

## Key Features

- **Lightweight**: With a bundle size of approximately 5 KB (zipped), Streamix is optimized for performance and efficiency.
- **Familiar API**: If you're already familiar with RxJS, you'll find Streamix easy to pick up, as it supports many core RxJS operators.
- **Unique Tools**: Streamix includes specialized tools for handling heavy computational tasks, making it suitable for performance-oriented applications.
- **Asynchronous Support**: It simplifies asynchronous programming, allowing you to manage user interactions, network requests, and UI updates seamlessly.
- **Streams and Emissions**: Streamix introduces a simplified concept of streams (represented as async generator functions) and emissions, making it easier to work with asynchronous data flows.
---

## Core Concepts

- **Stream**: A sequence of values over time, represented as an async generator function.
- **Emission**: Individual values emitted by a stream, along with metadata (e.g., cancellation, errors).
- **Operator**: Functions that transform, filter, or combine streams.
- **Subject**: A special type of stream that allows manual dispatching of emissions.

---

## Installation

Install Streamix via npm:

```bash
npm install @actioncrew/streamix
```
---

## Usage Example
Here's an example of using Streamix to compute and render a Mandelbrot set on an HTML canvas:
```typescript
import { compute, concatMap, coroutine, debounce, finalize, map, mergeMap, onResize, range, scan, startWith, Stream, tap } from '@actioncrew/streamix';

const task = coroutine(computeMandelbrotInChunks, computeMandelbrot, computeColor);
this.canvas = document.getElementById('mandelbrotCanvas')! as HTMLCanvasElement;

const subscription = onResize(this.canvas).pipe(
  startWith({ width: window.innerWidth, height: window.innerHeight }),
  tap(({width, height}) => {
    this.showProgressOverlay();
    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.clearRect(0, 0, width, height);
  }),
  debounce(100),
  concatMap(({width, height}: any) => {
    const imageData = this.ctx.createImageData(width, height);
    const data = imageData.data;

    return range(0, width * height, 1000).pipe(
      map(index => ({ index, width, height, maxIterations: 20, zoom: 200,
                      centerX: width / 2, centerY: height / 2,
                      panX: 0.5, panY: 0 })),
      mergeMap((params) => compute(task, params)),
      tap((result: any) => {
        result.forEach(({ px, py, r, g, b }: any) => {
          const i = py * width + px;
          const index = i * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = 255;
        });
      }),
      scan((acc, _, index) => {
        const progress = ((index! + 1) * 1000 / (width * height)) * 100;
        requestAnimationFrame(() => this.updateProgressBar(progress));
        return acc;
      }, 0),
      finalize(() => {
        this.ctx.putImageData(imageData, 0, 0);
        this.hideProgressOverlay();
      })
    )}),
    finalize(() => {
      task.finalize();
    })
).subscribe();
```

---

## Supported Operators

| Operator | Description |
|----------|-------------|
| `EMPTY` | Represents an empty stream. |
| `bufferCount` | Buffers emitted values and outputs them in chunks. |
| `catchError` | Catches errors and handles them gracefully. |
| `combineLatest` | Combines the latest values from multiple streams. |
| `compute` | Computes values based on a transformation function. |
| `concat` | Emits values from multiple streams sequentially. |
| `concatMap` | Maps each value to a stream and flattens the result sequentially. |
| `coroutine` | Enables coroutine-based stream handling. |
| `debounce` | Delays emissions when rapid events occur. |
| `defaultIfEmpty` | Emits a default value if no values are emitted. |
| `defer` | Creates a stream that defers its execution until subscribed. |
| `delay` | Delays emitted values by a specified time. |
| `distinctUntilChanged` | Filters out consecutive duplicate values. |
| `eachValueFrom` | Iterates over values in an async generator. |
| `empty` | Emits nothing and completes immediately. |
| `endWith` | Emits additional values at the end of a stream. |
| `filter` | Filters values based on a predicate function. |
| `finalize` | Runs a final action when the stream completes. |
| `firstValueFrom` | Extracts the first emitted value from a stream. |
| `fork` | Splits a stream into multiple independent streams. |
| `from` | Converts an array or promise into a stream. |
| `fromEvent` | Creates a stream from DOM events. |
| `fromPromise` | Converts a promise into a stream. |
| `groupBy` | Groups emitted values based on a key selector. |
| `initHttp` | Initializes an HTTP request stream. |
| `iif` | Conditional stream creation based on a boolean condition. |
| `interval` | Emits values at a set interval. |
| `jsonp` | Makes a JSONP request and returns a stream. |
| `lastValueFrom` | Extracts the last emitted value from a stream. |
| `loop` | Repeats emissions indefinitely. |
| `map` | Transforms each value in the stream using a provided function. |
| `merge` | Combines multiple streams into one. |
| `mergeMap` | Maps each value to a stream and flattens the result concurrently. |
| `of` | Emits a fixed set of values. |
| `onAnimationFrame` | Emits values on each animation frame. |
| `onIntersection` | Emits values when an element intersects with the viewport. |
| `onMediaQuery` | Emits values based on media query changes. |
| `onMutation` | Emits values on DOM mutations. |
| `onResize` | Emits values when an element is resized. |
| `range` | Emits a sequence of numbers. |
| `reduce` | Accumulates values into a single result. |
| `retry` | Retries a failed stream operation. |
| `scan` | Accumulates values, emitting intermediate results. |
| `skip` | Skips a specified number of emitted values. |
| `slidingPair` | Emits pairs of consecutive values. |
| `startWith` | Prepends initial values before the stream starts. |
| `switchMap` | Switches to a new inner stream whenever a new value is emitted. |
| `take` | Emits only the first specified number of values. |
| `takeUntil` | Emits values until another stream emits a value. |
| `takeWhile` | Emits values while a condition holds true. |
| `tap` | Performs side effects without modifying emissions. |
| `timer` | Emits values after a delay. |
| `toArray` | Collects emitted values into an array. |
| `withLatestFrom` | Combines values from multiple streams. |
| `webSocket` | Creates a stream from a WebSocket connection, emitting messages as they arrive in real time. | 
| `zip` | Combines values from multiple streams in a one-to-one fashion. |

---


## Why Streamix?
Streamix is designed for those who need a straightforward way to manage asynchronous data without the complexity of larger frameworks. It's a great alternative to RxJS for simpler use cases, offering all the core functionality you need in a more lightweight, efficient package.

## Explore More
To see Streamix in action, check out these sample projects:
- [Simple animation](https://stackblitz.com/edit/stackblitz-starters-pkzdzmuk)
- [Heavy computational task](https://stackblitz.com/edit/stackblitz-starters-73vspfzz)

Interested in extending Streamix or using it in your project? Reach out to us! We’re excited to collaborate and help bring your ideas to life.

[More information](https://medium.com/p/00d5467f0c01)

