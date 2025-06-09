<h1 style="display: none;">Streamix</h1>

<p align="center">
  <img src="https://github.com/actioncrew/streamix/blob/main/projects/libraries/streamix/LOGO.png?raw=true" alt="Streamix Logo" width="400">
</p>

**Streamix** is a lightweight, no-fuss alternative to RxJS. It’s built for modern apps that care about performance but don’t want to deal with too much boilerplate. At just **9 KB zipped**, it gives you a clean and efficient way to work with reactive streams — and if you need to make HTTP requests, there’s a separate mini client (**~3 KB zipped**) ready to go.

[![build status](https://github.com/actioncrew/streamix/workflows/build/badge.svg)](https://github.com/actioncrew/streamix/workflows/build/badge.svg)
[![npm version](https://img.shields.io/npm/v/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
[![npm downloads](https://img.shields.io/npm/dm/@actioncrew%2Fstreamix.svg?style=flat-square)](https://www.npmjs.com/package/@actioncrew%2Fstreamix)
[![min+zipped](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)](https://img.shields.io/bundlephobia/minzip/%40actioncrew%2Fstreamix)

## 🧭 Quick Links
[🔧 Key Features /](#key-features)
[🚀 Example /](#usage-example)
[🔁 Operators /](#supported-operators)
[🌐 HTTP Client /](#http-client)
[❓Questionnare /](https://forms.gle/CDLvoXZqMMyp4VKu9)

## Why Generators?

Streamix is built around generators (the function* and async function* kind). That means it’s pull-based, so values are only produced when needed — nice for performance. Compare that to push-based systems like RxJS, which keep pushing data whether you're ready or not. With Streamix, you stay in control.

## What Makes Streamix Cool

- 🪶 **Super lightweight** — ~9 KB zipped
- 🎯 **Easy to learn** if you’ve used RxJS
- 🧠 **Smart tools** for heavy computation
- 🤝 **Async-friendly**, perfect for UI, events, and networking
- 🔁 **Simple concept**: async generators = streams

## Core Concepts

- **Stream**: A sequence of values over time, represented as an async generator function.
- **Emission**: The individual data yielded by a stream. The stream no longer uses the Emission abstraction. Instead, it directly represents the values that are emitted.
- **Operator**: Functions that transform, filter, or combine streams.
- **Subject**: A special type of stream that allows manual dispatching of emissions.

## Installation

Install Streamix via npm:

```bash
npm install @actioncrew/streamix
```

## 🚀 Example
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

## 📦 Operators

Streamix ships with a lot of familiar (and some unique) operators:
✅ map, filter, mergeMap, scan, tap, take, switchMap, combineLatest, delay, retry, finalize
🔄 ...and many more.

## HTTP Client

Streamix also includes a neat HTTP client with middleware and stream support.

```typescript
import { createHttpClient, readJson, useBase, useLogger, useTimeout } from './httpClient';

async function fetchData() {
  // Create an HTTP client with middleware for base URL, logging, and timeout
  const client = createHttpClient().withDefaults(
    useBase("https://api.example.com"), // Set the base URL
    useLogger(), // Log requests and responses
    useTimeout(5000), // Set a 5-second timeout
  );

  // Make a GET request to the "/data" endpoint and parse the response as JSON
  const responseStream = client.get("/data", readJson);

  try {
    // Iterate over the response stream and log each value
    for await (const value of eachValueFrom(responseStream)) {
      console.log("Received data:", value);
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

fetchData();
```

## 🧠 Why Choose Streamix?
If RxJS feels like overkill for your use case, Streamix gives you a clean, minimal alternative. You still get all the power, but with simpler building blocks and way less overhead.

## 🎮 Try It Out
Check out these live demos:
- [🌀 Simple animation](https://stackblitz.com/edit/stackblitz-starters-pkzdzmuk)
- [⚙️ Heavy computation](https://stackblitz.com/edit/stackblitz-starters-73vspfzz)
- [✈️ Travel blog](https://stackblitz.com/edit/stackblitz-starters-873uh85w)

Interested in extending Streamix or using it in your project? Reach out to us! We’re excited to collaborate and help bring your ideas to life.

## More Information
[Exploring Streamix: A Lightweight Alternative to RxJS](https://medium.com/p/00d5467f0c01)<br>
[Streamix 2.0.1: Embracing Async Iterators for Simpler, Faster Reactive Streams](https://medium.com/p/a1eb9e7ce1d7)<br>
[Simplifying Reactive Programming Approach with Active Subscriptions in JavaScript](https://medium.com/p/0bfc206ad41c)<br>


