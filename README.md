# Streamix

Streamix is a lightweight alternative to RxJS that implements reactive programming with a simplified concept of streams and emissions. If you're already familiar with RxJS, you’ll find Streamix easy to pick up, but with a fresh, minimalistic approach designed for modern, performance-oriented applications.

Streamix supports many core RxJS operators, along with unique tools designed to handle heavy computational tasks. It is a weighed solution that combines simplicity of development with an ultra-light footprint, with a bundle size of approximately **5 KB (zipped)**. By maintaining a minimalist and functional design, it ensures that developers can build reactive programs with minimal complexity.

  [![build status](https://github.com/actioncrew/streamix/workflows/build/badge.svg)](https://github.com/actioncrew/streamix/workflows/build/badge.svg)
  [![npm version](https://img.shields.io/npm/v/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
  [![npm downloads](https://img.shields.io/npm/dm/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
  [![min+zipped](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)

```javascript
    import { compute, concatMap, coroutine, debounce,
             finalize, map, mergeMap, onResize, range,
             scan, startWith, Stream, tap } from '@actioncrew/streamix';

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

## The Asynchronous Future
Today's development landscape revolves around asynchronous challenges: managing user interactions, network requests, and ensuring a responsive UI. In such a world, synchronous programming is a thing of the past, and async/await reigns supreme.

However, the complexity of asynchronous programming can sometimes feel overwhelming, especially for simple projects or specific use cases where lightweight, easy-to-understand tools are more suitable.

Streamix offers a simple, effective way to handle asynchronous data streams without the overhead of more advanced libraries like RxJS, while still maintaining robust features for dealing with async patterns.

## Key Concepts
- Stream: A stream is a sequence of values over time, and it can be represented as an **async generator function**. So instead of familiar subscription you can use for await...of loop.
- Emission: The individual values emitted by a stream, along with metadata like whether the emission was canceled or if it encountered an error.
- Operator: Functions that transform, filter, or combine streams of data.
- Subject: A special type of stream that allows manually dispatching emissions. Subjects can also be used to share a single execution path among multiple subscribers.

## Why Streamix?
Streamix is designed for those who need a straightforward way to manage asynchronous data without the complexity of larger frameworks. It's a great alternative to RxJS for simpler use cases, offering all the core functionality you need in a more lightweight, efficient package.

## Explore More
To see Streamix in action, check out these sample projects:
[Sample projects](https://github.com/actioncrew/streamix/)

Interested in extending Streamix or using it in your project? Reach out to us! We’re excited to collaborate and help bring your ideas to life.

[More information](https://medium.com/p/00d5467f0c01)

