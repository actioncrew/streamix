import { catchError } from '@actioncrew/streamix';
import {
  accept,
  base,
  createHttpClient,
  fallback,
  logging,
  readFull,
  readJson,
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
    for await (const value of responseStream) {
      console.log('Received data:', value);
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
    for await (const value of responseStream) {
      console.log('Post response:', value);
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
    for await (const value of responseStream) {
      console.log('Binary data:', value);
    }
  } catch (error) {
    console.error('Binary test error', error);
  }
}

async function testNotFound() {
  const client = createHttpClient();
  client.use(base('http://localhost:3000'));
  const responseStream = client.get('/not-found', readText);
  try {
    for await (const value of responseStream) {
      console.log('Not found response:', value);
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
    for await (const value of responseStream) {
      console.log('Redirect response:', value);
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
    for await (const value of responseStream) {
      console.log('Redirect response:', value);
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
    for await (const value of responseStream) {
      console.error('Error timeout response:', value);
    }
  } catch (error) {
    console.log('Timeout', error);
  }
}

(async () => {
  await fetchData();
  await postData();
  await testBinary();
  await testNotFound();
  await testRedirect();
  await testManualRedirect();
  await testTimeout();
})();
