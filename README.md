# TypeScript Test Runner

Run your Jasmine TypeScript tests in multiple environments: browsers, headless browsers, or Node.js.

## What This Tool Does

- Compiles your TypeScript test files
- Runs Jasmine tests in your chosen environment:
  - **Real browsers** (Chrome, Firefox, Safari) - for DOM and browser API testing
  - **Headless browsers** - same browser environments without UI (perfect for CI/CD)
  - **Node.js** - fastest execution for pure logic testing
- Supports **code coverage** via Istanbul instrumentation

## Installation

```bash
# Core dependencies
npm install --save-dev @actioncrew/ts-test-runner

# For browser testing (optional but recommended)
npx playwright install
```

## Quick Start

### 1. Initialize Your Project
```bash
npx ts-test-runner init
```
This creates `ts-test-runner.json` with default settings based on your project.

### 2. Write Jasmine Tests
Create `.spec.ts` files in your test directory:

```typescript
// tests/calculator.spec.ts
import { Calculator } from '../lib/calculator';

describe('Calculator', () => {
  let calc: Calculator;

  beforeEach(() => {
    calc = new Calculator();
  });

  it('should add two numbers', () => {
    expect(calc.add(2, 3)).toBe(5);
  });

  it('should handle browser APIs', () => {
    // This test will work in browser environments
    if (typeof window !== 'undefined') {
      expect(window.location).toBeDefined();
    }
  });
});
```

### 3. Run Your Tests

```bash
# Development: Open tests in browser with visual reporter
npx ts-test-runner

# CI/CD: Run headless in Chrome
npx ts-test-runner --headless

# Fastest: Run directly in Node.js (no browser overhead)
npx ts-test-runner --headless --browser node

# With coverage enabled (Istanbul instrumentation)
npx ts-test-runner --coverage
```

## Coverage Mode

When `--coverage` is enabled:
- Source files are instrumented using **istanbul-lib-instrument** during preprocessing.
- Coverage data is collected while tests run.
- Reports are generated using **istanbul-lib-report** and **istanbul-reports**.
- Supported output formats: `html`, `lcov`, `text`, `text-summary`.

Coverage reports are generated in the `coverage/` folder by default:

```bash
npx ts-test-runner --coverage
# → ./coverage/index.html
```

You can open the HTML report in your browser for detailed line-by-line analysis.

## Execution Environments

### Browser Mode (Default)
**Best for:** Development and debugging
```bash
npx ts-test-runner
```
- Opens `http://localhost:8888` in your default browser
- Interactive HTML test reporter
- Full browser DevTools for debugging
- Access to DOM, localStorage, fetch, etc.

### Headless Browser Mode
**Best for:** CI/CD and automated testing
```bash
# Chrome (default)
npx ts-test-runner --headless

# Test in Firefox
npx ts-test-runner --headless --browser firefox

# Test in Safari/WebKit
npx ts-test-runner --headless --browser webkit
```
- Runs in real browser without UI
- Full browser API support
- Console output with test results
- Great for cross-browser testing

### Node.js Mode
**Best for:** Fast unit testing
```bash
npx ts-test-runner --headless --browser node
```
- Fastest execution (no browser startup)
- Limited to Node.js APIs only
- Perfect for testing pure TypeScript logic
- No DOM or browser-specific APIs

## Project Structure

The test runner expects this structure (customizable in config):

```
your-project/
├── src/lib/                   # Your TypeScript source code
├── src/tests/                 # Your .spec.ts test files
├── dist/.vite-jasmine-build/  # Compiled output (auto-generated)
├── ts-test-runner.json        # Configuration file
└── tsconfig.json              # TypeScript configuration
```

## Configuration File

After running `init`, you'll have a `ts-test-runner.json`:

```json
{
  "srcDir": "./src/lib",           // Your source code location  
  "testDir": "./src/tests",        // Your test files location
  "outDir": "./dist/.vite-jasmine-build",  // Build output
  "tsconfig": "tsconfig.json",     // TypeScript config
  "port": 8888,                    // Development server port
  "browser": "chrome",             // Default browser for headless
  "headless": false,               // Default to browser mode
  "coverage": false,               // Enable Istanbul coverage
  "htmlOptions": {
    "title": "My Project Tests"    // Browser page title
  }
}
```

---

(Existing sections unchanged below)