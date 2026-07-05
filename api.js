// ── api.js ──
const express = require('express');
const path = require('path');

// Create a NEW Express app just for Vercel
const app = express();

// Middleware
app.use(express.json());

// Serve static files (LOOK at the path carefully)
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// API Test Route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// Export for Vercel
module.exports = app;