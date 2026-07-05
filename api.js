// ── api.js ──
const express = require('express');
const path = require('path');
const app = express();

// Serve static files from the main folder
app.use(express.static(__dirname));

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

// API routes
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

module.exports = app;