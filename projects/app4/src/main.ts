import { catchError } from '@actioncrew/streamix';
import {
  accept,
  base,
  createHttpClient,
  fallback,
  header,
  logging,
  readChunks,
  readFull,
  readJson,
  readNdjsonChunk,
  readText,
  redirect,
  timeout,
} from '@actioncrew/streamix/http';

async function fetchData() {
  const client = createHttpClient();

  client
    .use(base('http://localhost:3000'))
    .use(accept('application/json'))
    .use(logging())
    .use(timeout(5000))
    .use(
      fallback((error, context) => {
        console.error('Request failed:', error);
        return context;
      }),
    );

  const responseStream = client.get('/data', readJson);

  try {
    for await (const emission of responseStream) {
      console.log('Received data:', emission.value);
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  }
}


async function postData() {
  const client = createHttpClient();

  client
    .use(base('http://localhost:3000'))
    .use(logging())
    .use(
      fallback((error, context) => {
        console.error('Post request failed:', error);
        return context;
      }),
    );

  const responseStream = client.post('/items', readText, {
    body: { name: 'example', value: 42 },
  });

  try {
    for await (const emission of responseStream) {
      console.log('Post response:', emission.value);
    }
  } catch (error) {
    console.error('Post request error', error);
  }
}

async function testBinary() {
  const client = createHttpClient();
  client.use(base('http://localhost:3000'));
  const responseStream = client.get('/binary', readFull);
  try {
    for await (const emission of responseStream) {
      console.log('Binary data:', emission.value);
    }
  } catch (error) {
    console.error('Binary test error', error);
  }
}

async function testNotFound() {
  const client = createHttpClient();
  client.use(base('http://localhost:3000'));
  const responseStream = client.get('/not-found', readText).pipe(catchError(() => console.log('Not found as expected')));;
  try {
    for await (const emission of responseStream) {
      console.log('Not found response:', emission.value);
    }
  } catch (error) {
    console.error('Not found test error', error);
  }
}

async function testRedirect() {
  const client = createHttpClient();
  client.use(base('http://localhost:3000'));
  client.use(redirect(2));

  const responseStream = client.get('/auto-redirect', readJson);
  try {
    for await (const emission of responseStream) {
      console.log('Redirect response:', emission.value);
    }
  } catch (error) {
    console.error('Redirect test error', error);
  }
}

async function testManualRedirect() {
  const client = createHttpClient();
  client.use(base('http://localhost:3000'));
  client.use(redirect(2));

  const responseStream = client.get('/manual-redirect', readJson);
  try {
    for await (const emission of responseStream) {
      console.log('Redirect response:', emission.value);
    }
  } catch (error) {
    console.error('Redirect test error', error);
  }
}

async function testTimeout() {
  const client = createHttpClient();
  client.use(base('http://localhost:3000'));
  client.use(timeout(1000));
  const responseStream = client.get('/timeout', readText).pipe(catchError(() => console.log('Timeout as expected')));
  try {
    for await (const emission of responseStream) {
      console.error('Error timeout response:', emission.value);
    }
  } catch (error) {
    console.log('Timeout', error);
  }
}

async function testOllama() {
  const client = createHttpClient();

  client
    .use(base('http://localhost:11434')) // Ollama server
    .use(logging())
    .use(header("Content-Type", "application/json"))
    .use(accept('application/json'))
    .use(
      fallback((error, context) => {
        console.error('Ollama request failed:', error);
        return context;
      }),
    );

  const responseStream = client.post('/api/generate', readChunks(readNdjsonChunk), { body: { model: "phi3:latest", prompt: "What is the capital of France?" } });
  let fullResponse = "";

  try {
    for await (const emission of responseStream) {
      if (emission && emission.value?.chunk?.response) {
        fullResponse += emission.value.chunk.response;
      };
    }
    console.log(fullResponse);
  } catch (error) {
    console.error('Ollama request error:', error);
  }
}

let typingQueue: (() => void)[] = [];

function typeEffectOutput(message: string, isError: boolean = false) {
  const outputContainer = document.getElementById('output');
  if (!outputContainer) return;

  const outputElement = document.createElement('div');
  outputElement.style.whiteSpace = 'pre-wrap';  // Ensure line breaks
  outputElement.style.color = isError ? 'red' : 'green';
  outputElement.style.marginBottom = '10px';  // Add some spacing between rows
  outputContainer.appendChild(outputElement);

  let index = 0;
  const typingSpeed = 10;  // Adjust typing speed here

  function type() {
    if (index < message.length) {
      outputElement.innerText += message.charAt(index);
      index++;
      setTimeout(type, typingSpeed);
    } else {
      // Once typing finishes, call the next message in the queue (if any)
      const nextMessage = typingQueue.shift();
      if (nextMessage) {
        nextMessage();
      }
    }
  }

  typingQueue.push(type);  // Add the typing function to the queue
  if (typingQueue.length === 1) { // If it's the first message, start typing
    typingQueue[0]();
  }
}

console.log = (...args: any[]) => {
  args.forEach(arg => {
    const message = typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
    typeEffectOutput(message, false);
  });
};

console.error = (...args: any[]) => {
  args.forEach(arg => {
    const message = typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
    typeEffectOutput(message, true);
  });
};

// You can also add a container in HTML for the output to appear
document.body.innerHTML += '<div id="output" style="font-family: monospace; padding: 20px;"></div>';

(async () => {
  await testOllama();
  await fetchData();
  await postData();
  await testBinary();
  await testNotFound();
  await testRedirect();
  await testManualRedirect();
  await testTimeout();
})();

