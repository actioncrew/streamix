import { map, take, tap } from '../operators';
import { coroutine } from '../operators/coroutine';
import { from, interval } from '../streams';
import { createWorkerScript, workerBroadcast, workerChannel, WorkerChannel, workerDuplex, workerMap } from './worker-interaction';

// Example 1: Basic bidirectional communication
async function example1_BasicCommunication() {
  // Create a coroutine that handles mathematical operations
  const mathWorker = coroutine(
    // Main worker function
    function mathProcessor(data) {
      switch (data.operation) {
        case 'factorial':
          let result = 1;
          for (let i = 2; i <= data.value; i++) {
            result *= i;
          }
          return { operation: data.operation, input: data.value, result };

        case 'fibonacci':
          const fib = (n) => n <= 1 ? n : fib(n - 1) + fib(n - 2);
          return { operation: data.operation, input: data.value, result: fib(data.value) };

        default:
          throw new Error(`Unknown operation: ${data.operation}`);
      }
    }
  );

  // Create a persistent worker channel
  const channel = workerChannel(mathWorker, { timeout: 10000, keepAlive: true });

  try {
    // Send some requests
    const factorial5 = await channel.request({ operation: 'factorial', value: 5 });
    console.log('Factorial 5:', factorial5);

    const fibonacci10 = await channel.request({ operation: 'fibonacci', value: 10 });
    console.log('Fibonacci 10:', fibonacci10);

    // Send fire-and-forget messages
    await channel.send({ operation: 'log', message: 'Processing complete' });

  } finally {
    await channel.close();
  }
}

// Example 2: Stream processing with worker map
async function example2_StreamProcessing() {
  const imageProcessor = coroutine(
    function processImage(imageData) {
      // Simulate image processing (blur, resize, etc.)
      const processed = {
        ...imageData,
        processed: true,
        timestamp: Date.now(),
        filters: ['blur', 'sharpen', 'contrast']
      };

      // Simulate processing time
      const delay = Math.random() * 1000 + 500;
      return new Promise(resolve => setTimeout(() => resolve(processed), delay));
    }
  );

  // Process a stream of images
  const imageStream = from([
    { id: 1, name: 'photo1.jpg', size: 1024 },
    { id: 2, name: 'photo2.jpg', size: 2048 },
    { id: 3, name: 'photo3.jpg', size: 512 },
    { id: 4, name: 'photo4.jpg', size: 4096 }
  ]);

  const processedImages = imageStream
    .pipe(
      tap(img => console.log(`Processing image: ${img.name}`)),
      workerMap(imageProcessor, { timeout: 15000 }),
      tap(result => console.log(`Completed: ${result.name} with filters: ${result.filters.join(', ')}`))
    );

  // Consume the stream
  for await (const result of processedImages) {
    console.log('Processed image result:', result);
  }
}

// Example 3: Real-time data broadcasting
async function example3_DataBroadcasting() {
  const analyticsWorker = coroutine(
    function analyzeData(data) {
      // Simulate real-time analytics processing
      console.log(`Worker analyzing data point:`, data);

      // Store in worker's internal state (you'd typically use a more sophisticated approach)
      if (!self.dataBuffer) self.dataBuffer = [];
      self.dataBuffer.push(data);

      // Keep only last 100 data points
      if (self.dataBuffer.length > 100) {
        self.dataBuffer = self.dataBuffer.slice(-100);
      }

      // Calculate some metrics
      const average = self.dataBuffer.reduce((sum, item) => sum + item.value, 0) / self.dataBuffer.length;

      return {
        processed: true,
        bufferSize: self.dataBuffer.length,
        runningAverage: average
      };
    }
  );

  // Create a stream of real-time data
  const dataStream = interval(1000)
    .pipe(
      take(20),
      map(i => ({
        timestamp: Date.now(),
        value: Math.random() * 100,
        source: 'sensor-' + (i % 3)
      }))
    );

  // Broadcast data to worker for analysis
  const broadcastStream = dataStream
    .pipe(
      workerBroadcast(analyticsWorker, { keepAlive: true }),
      tap(data => console.log(`Broadcasted data point ${data.value.toFixed(2)} from ${data.source}`))
    );

  // Process the stream
  for await (const data of broadcastStream) {
    console.log(`Data point processed: ${data.value.toFixed(2)}`);
  }
}

// Example 4: Duplex communication - bidirectional stream
async function example4_DuplexCommunication() {
  const chatWorker = coroutine(
    function processChatMessage(message) {
      // Simulate AI chat response with some delay
      const responses = [
        "That's interesting! Tell me more.",
        "I understand your point.",
        "Have you considered this alternative?",
        "That reminds me of something similar.",
        "Great question! Let me think about that."
      ];

      const response = {
        id: Date.now(),
        type: 'ai_response',
        message: responses[Math.floor(Math.random() * responses.length)],
        replyTo: message.id,
        timestamp: Date.now()
      };

      // Simulate processing time
      const delay = Math.random() * 2000 + 500;
      return new Promise(resolve => setTimeout(() => resolve(response), delay));
    }
  );

  const userMessages = from([
    { id: 1, type: 'user_message', message: 'Hello, how are you today?', timestamp: Date.now() },
    { id: 2, type: 'user_message', message: 'What do you think about the weather?', timestamp: Date.now() },
    { id: 3, type: 'user_message', message: 'Can you help me with a problem?', timestamp: Date.now() },
  ]);

  // Create duplex stream that includes both user messages and AI responses
  const chatStream = userMessages
    .pipe(
      workerDuplex(chatWorker, { timeout: 10000 }),
      tap(message => {
        if (message.type === 'user_message') {
          console.log(`User: ${message.message}`);
        } else if (message.type === 'ai_response') {
          console.log(`AI: ${message.message}`);
        }
      })
    );

  // Process the conversation
  for await (const message of chatStream) {
    console.log('Chat message:', message);
  }
}

// Example 5: Advanced worker with custom message handling
async function example5_CustomWorkerScript() {
  // Create a worker with custom message handling
  const customWorkerScript = createWorkerScript({
    onRequest: async (data) => {
      switch (data.command) {
        case 'process':
          return { result: data.value * 2, processed: true };
        case 'status':
          return { status: 'healthy', uptime: Date.now() - self.startTime };
        default:
          throw new Error(`Unknown command: ${data.command}`);
      }
    },

    onStream: async (data) => {
      // Handle streaming data (fire-and-forget)
      console.log('Worker received stream data:', data);
      if (!self.streamBuffer) self.streamBuffer = [];
      self.streamBuffer.push(data);
    },

    onPing: async (timestamp) => {
      // Custom ping handler
      return {
        pong: true,
        latency: Date.now() - timestamp,
        workerLoad: Math.random() * 100
      };
    }
  });

  // You would use this script to create a custom coroutine
  console.log('Custom worker script:', customWorkerScript);
}

// Run examples
export async function runWorkerExamples() {
  console.log('=== Example 1: Basic Communication ===');
  await example1_BasicCommunication();

  console.log('\n=== Example 2: Stream Processing ===');
  await example2_StreamProcessing();

  console.log('\n=== Example 3: Data Broadcasting ===');
  await example3_DataBroadcasting();

  console.log('\n=== Example 4: Duplex Communication ===');
  await example4_DuplexCommunication();

  console.log('\n=== Example 5: Custom Worker Script ===');
  await example5_CustomWorkerScript();
}

// Usage in a typical application
export class WorkerService {
  private workers: Map<string, WorkerChannel> = new Map();

  async createWorkerChannel<TIn, TOut>(
    name: string,
    task: any,
    config?: any
  ): Promise<WorkerChannel<TIn, TOut>> {
    if (this.workers.has(name)) {
      await this.workers.get(name)!.close();
    }

    const channel = workerChannel<TIn, TOut>(task, config);
    this.workers.set(name, channel);
    return channel;
  }

  async getWorker(name: string): Promise<WorkerChannel | undefined> {
    return this.workers.get(name);
  }

  async closeWorker(name: string): Promise<void> {
    const worker = this.workers.get(name);
    if (worker) {
      await worker.close();
      this.workers.delete(name);
    }
  }

  async closeAll(): Promise<void> {
    for (const [name, worker] of this.workers) {
      await worker.close();
    }
    this.workers.clear();
  }
}
