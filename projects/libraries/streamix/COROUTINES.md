# Streamix Coroutines: Making Heavy Tasks Feel Light

Ever noticed how your web app freezes when processing large files, running complex calculations, or handling lots of data? That's your browser's main thread getting overwhelmed. Streamix coroutines solve this by moving heavy work to background threads, keeping your app smooth and responsive.

## The Problem: When Apps Get Stuck

Imagine you're building a photo editor, data analyzer, or game. When users upload large files or request complex operations, everything stops:

- ❌ UI becomes unresponsive
- ❌ Buttons don't click
- ❌ Animations freeze
- ❌ Users think the app crashed

This happens because JavaScript normally runs everything on one thread - like having one person handle all tasks in a restaurant.

## The Solution: Coroutines as Your Background Workers

Coroutines are like hiring extra staff for your restaurant. They:

- ✅ **Keep your app responsive** - UI stays smooth while work happens in background
- ✅ **Handle heavy lifting** - Process large datasets without blocking interactions  
- ✅ **Scale automatically** - Use all your computer's CPU cores efficiently
- ✅ **Communicate safely** - Send data back and forth between main app and workers
- ✅ **Support modern code** - Use TypeScript, async/await, and all your favorite features

### Key Advantages Over Traditional Solutions

| Feature | Streamix Coroutines | Traditional Web Workers | Other Libraries |
|---------|---------------------|------------------------|----------------|
| Setup Complexity | ⭐ Simple | ⚠️ Complex | ⚠️ Medium |
| TypeScript Support | ✅ Native | ❌ Manual | ⚠️ Partial |
| Stream Integration | ✅ Built-in | ❌ Manual | ⚠️ Limited |
| Error Handling | ✅ Robust | ⚠️ Basic | ⚠️ Varies |
| Progress Reporting | ✅ Built-in | ❌ Manual | ⚠️ Limited |
| Resource Management | ✅ Automatic | ❌ Manual | ⚠️ Limited |

## Installation

Getting started with Streamix Coroutines is simple:

```bash
# Using npm
npm install @actioncrew/streamix

# Or using yarn
yarn add @actioncrew/streamix
```

## Quick Start: Your First Coroutine

Let's say you want to process a large list of numbers without freezing your app:

```typescript
import { coroutine } from 'streamix';

// Create a background worker for heavy math
const mathWorker = coroutine(function calculatePrimes(data: { max: number }) {
  const primes: number[] = [];
  
  // This would normally freeze your UI
  for (let num = 2; num <= data.max; num++) {
    let isPrime = true;
    for (let i = 2; i < num; i++) {
      if (num % i === 0) {
        isPrime = false;
        break;
      }
    }
    if (isPrime) primes.push(num);
  }
  
  return { primes, count: primes.length };
});

// Use it without blocking your UI
const result = await mathWorker.processTask({ max: 10000 });
console.log(`Found ${result.count} prime numbers!`);
```

Your app stays responsive while the heavy calculation runs in the background!

## Real-World Examples

### Photo Processing App

```typescript
// Process images without freezing the interface
const imageProcessor = coroutine(function enhanceImage(imageData: ImageData) {
  // Apply filters, resize, enhance contrast, etc.
  const enhanced = applyFilters(imageData);
  return enhanced;
});

// User can still interact with your app while images process
fileInput.addEventListener('change', async (event) => {
  for (const file of event.target.files) {
    const result = await imageProcessor.processTask(file);
    displayResult(result); // Show each image as it's ready
  }
});
```

### Data Analysis Dashboard

```typescript
// Crunch numbers in the background
const dataAnalyzer = coroutine(function analyzeData(dataset: DataPoint[]) {
  // Complex statistical calculations
  const stats = {
    average: dataset.reduce((sum, point) => sum + point.value, 0) / dataset.length,
    trends: calculateTrends(dataset),
    predictions: runMLModel(dataset)
  };
  
  return stats;
});

// Dashboard stays interactive while analysis runs
const analysisResults = await dataAnalyzer.processTask(bigDataset);
updateCharts(analysisResults);
```

### Game Engine

```typescript
// Handle complex game logic without dropping frames
const gameEngine = coroutine(function simulatePhysics(entities: GameObject[]) {
  // Heavy physics calculations
  for (const entity of entities) {
    updatePosition(entity);
    checkCollisions(entity);
    applyForces(entity);
  }
  
  return entities;
});

// Game loop stays smooth at 60fps
setInterval(async () => {
  const updatedEntities = await gameEngine.processTask(gameObjects);
  render(updatedEntities);
}, 16); // 60fps
```

## Advanced Features (When You Need Them)

### Fine-Tuning Your Coroutines
For specialized use cases, Streamix coroutines offer powerful configuration options:

```typescript
import { coroutine, CoroutineConfig } from 'streamix';

// Create a custom configuration
const config: CoroutineConfig = {
  // Add global imports/declarations
  globals: `import { complex } from 'complex-math';`,
  
  // Add helper functions
  helpers: [
    `function customHelper(data) { 
      return complex(data.value).calculate();
    }`
  ],
  
  // Run initialization code
  initCode: `console.log('Worker initialized!');`
};

// TypeScript doesn't know that customHelper is provided by 
// the helpers configuration at runtime
declare const customHelper: (data: any[]) => any;

// Create coroutine with configuration
const customWorker = coroutine<any, any>(config)(function processData(data) {
  
  // Use custom helper
  const filtered = customHelper(data.items);
  
  return { result, filtered };
});

// Use like regular coroutine
const output = await customWorker.processTask(inputData);
```

### Dedicated Workers: Persistent Worker Connections

For scenarios requiring multiple sequential operations on the same worker, use `seize`:

```typescript
import { seize } from '@actioncrew/streamix';

const processSequentialTasks = async () => {
  const seizedWorker = await seize(mathWorker).query();
  
  try {
    await seizedWorker.sendTask({ operation: 'initialize', data: largeDataset });
    await seizedWorker.sendTask({ operation: 'process', params: { threshold: 0.5 } });
    const finalResult = await seizedWorker.sendTask({ operation: 'finalize' });
    
    return finalResult;
  } finally {
    seizedWorker.release();
  }
};
```

### Sequential Processing Pipeline

Chain multiple processing steps:

```typescript
import { cascade } from 'streamix';

// Create specialized workers for each step
const decoder = coroutine(function decode(rawData) { /* decode logic */ });
const processor = coroutine(function process(decodedData) { /* process logic */ });
const encoder = coroutine(function encode(processedData) { /* encode logic */ });

// Chain them together
const pipeline = cascade(decoder, processor, encoder);

// Data flows through all steps automatically
const result = await pipeline.processTask(inputData);
```

## When to Use Coroutines

**Perfect for:**
- 🖼️ Image/video processing
- 📊 Large dataset analysis  
- 🎮 Game physics and AI
- 🧮 Mathematical computations
- 📄 File parsing and conversion
- 🔍 Search and filtering operations

**Not needed for:**
- 🌐 Simple API calls
- 📝 Basic form validation
- 🎨 Simple UI animations
- 💾 Small data operations

## Getting Started Checklist

1. **Identify heavy tasks** - What makes your app slow or unresponsive?
2. **Create a coroutine** - Use `coroutine(function taskName() {})` syntax
3. **Move heavy logic** - Put CPU-intensive work inside the coroutine function
4. **Process tasks** - Use `processTask()` to run work in background
5. **Handle results** - Your app stays responsive while getting results
6. **Add progress updates** - Keep users informed for long operations

## Key Rules (Keep These Simple)

✅ **Use this syntax**: `coroutine(function myTask() {})`  
❌ **Don't use**: Arrow functions or separate function declarations

✅ **Include everything inside**: Helper functions, types, logic all go in the coroutine function  
❌ **Don't reference outside**: Can't use variables or imports from outside the function

✅ **TypeScript works perfectly**: Use all your favorite TypeScript features  
✅ **Async/await supported**: Modern JavaScript features work great

## Why Streamix Coroutines Are Special

Unlike other solutions, Streamix coroutines:

- **Just work** with TypeScript - no special setup needed
- **Handle complexity** - Automatic worker management, no manual thread handling  
- **Play nice** - Integrate seamlessly with reactive streams
- **Scale naturally** - Use all available CPU cores automatically
- **Stay safe** - Prevent memory leaks and resource issues

## Try It Today

Start small - pick one slow operation in your app and wrap it in a coroutine. You'll immediately notice:

- Smoother user interactions
- Better perceived performance  
- Happier users who don't think your app crashed
- More professional feel to your application

Your users will thank you for keeping things responsive, and you'll wonder how you ever built complex apps without background processing!

---

*Ready to make your heavy tasks feel light? Install Streamix and start with your first coroutine today.*
