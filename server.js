import cors from "cors";
import express from "express";

const app = express();
const port = 3000;

const corsOptions = {
  origin: 'http://localhost:4200', // Allow your Angular app
  methods: ['GET', 'POST', 'OPTIONS'], // Add the methods you support
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Enable CORS for Angular
app.use(cors(corsOptions));

// Handle OPTIONS requests for preflight checks
// Enable pre-flight CORS handling (for non-GET, non-POST requests or specific headers)
app.options('*', cors(corsOptions));

app.use(express.json()); // For parsing application/json

// Example route for successful JSON response
app.post('/items', (req, res) => {
  res.sendStatus(201);
});
// Example route for successful JSON response
app.get('/data', (req, res) => {
    res.json({ message: 'Hello from the server!', data: { example: 42 } });
});
// Example route for successful text response
app.get('/text', (req, res) => {
    res.send('This is a plain text response.');
});

// Example route for binary data
app.get('/binary', (req, res) => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    res.send(buffer);
});

// Example route for 404 error
app.get('/not-found', (req, res) => {
    res.status(404).send('Not found');
});

// Example route for 500 error
app.get('/server-error', (req, res) => {
    res.status(500).send('Internal server error');
});

// Example route for redirects
app.get('/auto-redirect', (req, res) => {
    res.redirect('/data');
});

app.get('/manual-redirect', (req, res) => {
  res.status(302)
  .set('Location', '/data')
  .end();
});

// Example route for post requests
app.post('/items', (req, res) => {
    console.log("Received post request with body:", req.body);
    res.json({ message: 'Item created', received: req.body });
});

// Example route for timeout simulation
app.get('/timeout', (req, res) => {
    setTimeout(() => {
        res.send('Timeout response');
    }, 6000); // 6 seconds to trigger timeout
});

app.listen(port, () => {
    console.log(`Test server listening at http://localhost:${port}`);
});
