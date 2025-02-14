import cors from "cors";
import express from "express";

const app = express();
const PORT = 3000;
const FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 512 * 1024; // 512KB per chunk

// Generate a 10MB buffer filled with 1s
const largeFile = Buffer.alloc(FILE_SIZE, 1);

// Enable CORS for Angular
app.use(cors({
  origin: "http://localhost:4200", // Adjust as needed
  methods: "GET",
}));

// Stream the large file from memory
app.get("/large-file", (req, res) => {
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", FILE_SIZE);

  let offset = 0;

  function sendChunk() {
    if (offset >= largeFile.length) {
      res.end();
      return;
    }

    const chunk = largeFile.slice(offset, offset + CHUNK_SIZE);
    res.write(chunk);
    offset += CHUNK_SIZE;

    setTimeout(sendChunk, 10); // Simulate network latency
  }

  sendChunk();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
