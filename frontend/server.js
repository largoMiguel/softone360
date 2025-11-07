// Simple Express server to serve Angular build on Render
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// Path to Angular build output
const distPath = path.join(__dirname, 'dist', 'pqrs-frontend', 'browser');

// Static assets with sensible cache headers
app.use(express.static(distPath, {
    index: 'index.html',
    maxAge: '1h',
    setHeaders: (res, filePath) => {
        // Avoid caching index.html to prevent stale app shell
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// SPA fallback: send index.html for any unmatched route
app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`Frontend escuchando en http://0.0.0.0:${port}`);
});
