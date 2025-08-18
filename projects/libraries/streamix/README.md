<p align="center">
  <img src="https://github.com/actioncrew/streamix/blob/main/projects/libraries/streamix/LOGO.png?raw=true" alt="Streamix Logo" width="400">
</p>

<p align="center">
  <strong>A lightweight, high-performance alternative to RxJS</strong><br>
  Built for modern apps that need reactive streams without the complexity
</p>

<p align="center">
  <a href="https://github.com/actioncrew/streamix/workflows/build/badge.svg">
    <img src="https://github.com/actioncrew/streamix/workflows/build/badge.svg" alt="Build Status">
  </a>
  <a href="https://www.npmjs.com/package/@actioncrew%2Fstreamix">
    <img src="https://img.shields.io/npm/v/@actioncrew%2Fstreamix.svg?style=flat-square" alt="NPM Version">
  </a>
  <a href="https://www.npmjs.com/package/@actioncrew%2Fstreamix">
    <img src="https://img.shields.io/npm/dm/@actioncrew%2Fstreamix.svg?style=flat-square" alt="NPM Downloads">
  </a>
  <a href="https://github.com/actioncrew/streamix">
    <img src="https://raw.githubusercontent.com/actioncrew/streamix/main/projects/libraries/streamix/bundle-size.svg" alt="Bundle Size">
  </a>
  <a href="https://codecov.io/github/actioncrew/streamix" >
    <img src="https://codecov.io/github/actioncrew/streamix/graph/badge.svg?token=ITHDU7JVOI" alt="Code Coverage"/>
  </a>
  <a href="https://www.npmjs.com/package/@actioncrew/streamix">
    <img src="https://img.shields.io/badge/AI-Powered-blue" alt="AI-Powered">
  </a>
</p>

---

## 🚀 Why Streamix?

Streamix gives you all the power of reactive programming with **90% less complexity** than RxJS. At just **11 KB zipped**, it's perfect for modern applications that need performance without bloat.

### ✨ Key Benefits

- **🪶 Ultra Lightweight** — Only 9 KB zipped (vs RxJS's ~40 KB)
- **⚡ High Performance** — Pull-based execution means values are only computed when needed
- **🎯 Easy to Learn** — Familiar API if you know RxJS, simpler if you don't
- **🔄 Generator-Powered** — Built on async generators for natural async flow
- **🌐 HTTP Ready** — Optional HTTP client (~3 KB) for seamless API integration
- **🧠 Computation-Friendly** — Perfect for heavy processing tasks
- **👁️ Native DOM Observation** — Built-in streams for intersection, resize, and mutation events
---

## 📦 Installation

```bash
# npm
npm install @actioncrew/streamix

# yarn
yarn add @actioncrew/streamix

# pnpm
pnpm add @actioncrew/streamix
```

---

## 🏃‍♂️ Quick Start

### Basic Stream Operations

```typescript
import { eachValueFrom, range, map, filter, take } from '@actioncrew/streamix';

// Create a stream of numbers, transform them, and consume
const stream = range(1, 100)
  .pipe(
    map(x => x * 2),           // Double each number
    filter(x => x % 3 === 0),  // Keep only multiples of 3
    take(5)                    // Take first 5 results
  );

// Consume the stream
for await (const value of eachValueFrom(stream)) {
  console.log(value); // 6, 12, 18, 24, 30
}
```

### Handling User Events

```typescript
import { eachValueFrom, fromEvent, debounce, map } from '@actioncrew/streamix';

// Debounced search as user types
const searchInput = document.getElementById('search');
const searchStream = fromEvent(searchInput, 'input')
  .pipe(
    map(event => event.target.value),
    debounce(300), // Wait 300ms after user stops typing
    filter(text => text.length > 2)
  );

for await (const searchTerm of eachValueFrom(searchStream)) {
  console.log('Searching for:', searchTerm);
  // Perform search...
}
```

---

## 🔧 Core Concepts

### Streams
Streams are sequences of values over time, implemented as async generators:

```typescript
// Creating a custom stream
async function* numberStream() {
  for (let i = 0; i < 10; i++) {
    yield i;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

const stream = createStream('numberStream', numberStream);
```

### Operators
Transform, filter, and combine streams with familiar operators:

```typescript
import { map, filter, mergeMap, combineLatest } from '@actioncrew/streamix';

const processedStream = sourceStream
  .pipe(
    map(x => x * 2),
    filter(x => x > 10),
    mergeMap(x => fetchDataFor(x))
  );
```

### Subjects
Manually control stream emissions:

```typescript
import { eachValueFrom, Subject, createSubject } from '@actioncrew/streamix';

const subject = createSubject<string>();

// Subscribe to the subject
for await (const value of eachValueFrom(subject)) {
  console.log('Received:', value);
}

// Emit values
subject.next('Hello');
subject.next('World');
subject.complete();
```

---

## 🌐 HTTP Client

Streamix includes a powerful HTTP client perfect for reactive applications:

```typescript
import { eachValueFrom, map, retry } from '@actioncrew/streamix';
import { 
  createHttpClient, 
  readJson, 
  useBase, 
  useLogger, 
  useTimeout 
} from '@actioncrew/streamix/http';

// Setup client with middleware
const client = createHttpClient().withDefaults(
  useBase("https://api.example.com"),
  useLogger(),
  useTimeout(5000)
);

// Make reactive HTTP requests
const dataStream = retry(() => client.get("/users", readJson), 3)
  .pipe(
    map(users => users.filter(user => user.active))
  );

for await (const activeUsers of eachValueFrom(dataStream)) {
  console.log('Active users:', activeUsers);
}
```

---

## 🎯 Real-World Example

Here's how to build a live search with API calls and error handling:

```typescript
import {
  eachValueFrom,
  fromEvent,
  fromPromise,
  debounce, 
  map, 
  filter, 
  switchMap, 
  catchError,
  startWith 
} from '@actioncrew/streamix';

const searchInput = document.getElementById('search');
const resultsDiv = document.getElementById('results');

const searchResults = fromEvent(searchInput, 'input')
  .pipe(
    map(e => e.target.value.trim()),
    debounce(300),
    filter(query => query.length > 2),
    switchMap(query => fromPromise(
      fetch(`/api/search?q=${query}`)
        .then(r => r.json())
        .catch(err => ({ error: 'Search failed', query })))
    ),
    startWith({ results: [], query: '' })
  );

for await (const result of eachValueFrom(searchResults)) {
  if (result.error) {
    resultsDiv.innerHTML = `<p class="error">${result.error}</p>`;
  } else {
    resultsDiv.innerHTML = result.results
      .map(item => `<div class="result">${item.title}</div>`)
      .join('');
  }
}
```

---

## 📚 Available Operators

Streamix includes all the operators you need:

### Transformation
- `map` - Transform each value
- `scan` - Accumulate values over time
- `buffer` - Collect values into arrays

### Filtering
- `filter` - Keep values that match criteria  
- `take` - Take first N values
- `takeWhile` - Take while condition is true
- `skip` - Skip first N values
- `distinct` - Remove duplicates

### Combination
- `mergeMap` - Merge multiple streams
- `switchMap` - Switch to latest stream
- `combineLatest` - Combine latest values
- `concat` - Connect streams sequentially

### Utility
- `tap` - Side effects without changing stream
- `delay` - Add delays between emissions
- `retry` - Retry failed operations  
- `finalize` - Cleanup when stream completes
- `debounce` - Limit emission rate

---

## 🎮 Live Demos

Try Streamix in action:

- **🌀 [Simple Animation](https://stackblitz.com/edit/stackblitz-starters-pkzdzmuk)** - Smooth animations with streams
- **⚙️ [Heavy Computation](https://stackblitz.com/edit/stackblitz-starters-73vspfzz)** - Mandelbrot set generation
- **✈️ [Travel Blog](https://stackblitz.com/edit/stackblitz-starters-873uh85w)** - Real-world app example

---

## 🔄 Generator-Based Architecture

Unlike RxJS's push-based approach, Streamix uses **pull-based** async generators:

```typescript
// Values are only computed when requested
async function* expensiveStream() {
  for (let i = 0; i < 1000000; i++) {
    yield expensiveComputation(i); // Only runs when needed!
  }
}

// Memory efficient - processes one value at a time
const stream = createStream('expensiveStream', expensiveStream)
  .pipe(take(10)); // Only computes first 10 values
```

This means:
- **Better performance** - No wasted computations
- **Lower memory usage** - Process one value at a time  
- **Natural backpressure** - Consumer controls the flow

---

## 🆚 Streamix vs RxJS

| Feature | Streamix | RxJS |
|---------|----------|------|
| Bundle Size | 9 KB | ~40 KB |
| Learning Curve | Gentle | Steep |
| Performance | Pull-based (efficient) | Push-based |
| API Complexity | Simple | Complex |
| Async/Await Support | Native | Limited |
| Memory Usage | Low | Higher |

---

## 📖 Documentation & Resources

- **📝 [API Documentation](https://actioncrew/github.io/streamix)** 
- **📰 [Blog: Exploring Streamix](https://medium.com/p/00d5467f0c01)**
- **🔄 [Streamix 2.0 Updates](https://medium.com/p/a1eb9e7ce1d7)**
- **🎯 [Reactive Programming Guide](https://medium.com/p/0bfc206ad41c)**

---

## 🤝 Contributing

We'd love your help making Streamix even better! Whether it's:

- 🐛 **Bug reports** - Found something broken?
- 💡 **Feature requests** - Have a great idea?  
- 📝 **Documentation** - Help others learn
- 🔧 **Code contributions** - Submit a PR

**[📋 Share your feedback](https://forms.gle/CDLvoXZqMMyp4VKu9)** - Tell us how you're using Streamix!

---

## 📄 License

MIT License - use Streamix however you need!

---

<p align="center">
  <strong>Ready to stream? Get started with Streamix today! 🚀</strong><br>
  <a href="https://www.npmjs.com/package/@actioncrew/streamix">Install from NPM</a> • 
  <a href="https://github.com/actioncrew/streamix">View on GitHub</a> • 
  <a href="https://forms.gle/CDLvoXZqMMyp4VKu9">Give Feedback</a>
</p>
