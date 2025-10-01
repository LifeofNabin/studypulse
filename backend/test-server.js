// Simple test server to check if basic Express works
const express = require('express');

console.log('Starting test server...');

const app = express();
const PORT = 8000;

app.get('/test', (req, res) => {
  res.json({ message: 'Test server working!' });
});

app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});

console.log('Test server setup complete');