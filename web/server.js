const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const url = require('url');

const PORT = process.env.PORT || 5173;
const DIST_DIR = path.join(__dirname, 'dist');
const API_KEY = process.env.API_KEY || 'changeme';

// Reverse proxy routes — the server attaches the API key, never the browser
const PROXY_ROUTES = [
  { prefix: '/api', target: process.env.QUERY_API_URL || 'http://query-api:8000' },
  { prefix: '/ingest-api', target: process.env.INGEST_API_URL || 'http://ingestion:8001' },
  { prefix: '/mcp', target: process.env.MCP_API_URL || 'http://mcp-server:8002' },
];

function proxyRequest(req, res, route) {
  const target = new URL(route.target);
  let targetPath = req.url.slice(route.prefix.length);
  if (!targetPath.startsWith('/')) {
    targetPath = '/' + targetPath;
  }

  const headers = { ...req.headers };
  delete headers.host;
  headers.host = target.host;
  if (!headers.authorization) {
    headers.authorization = `Bearer ${API_KEY}`;
  }

  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port || 80,
      path: targetPath,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      // Stream through without buffering (SSE-safe)
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
}

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function shouldGzip(filePath) {
  const ext = path.extname(filePath);
  return ['.js', '.css', '.json', '.html', '.svg'].includes(ext);
}

const server = http.createServer((req, res) => {
  // Parse URL and remove query string
  const urlPath = url.parse(req.url).pathname;

  // Proxy API requests to the backends
  for (const route of PROXY_ROUTES) {
    if (urlPath === route.prefix || urlPath.startsWith(route.prefix + '/')) {
      proxyRequest(req, res, route);
      return;
    }
  }

  let filePath = path.join(DIST_DIR, urlPath);

  // Default to index.html for root
  if (filePath === DIST_DIR || filePath === DIST_DIR + '/') {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  // Normalize the file path
  filePath = path.normalize(filePath);

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If file not found, return index.html (SPA routing)
      filePath = path.join(DIST_DIR, 'index.html');
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }

        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const acceptEncoding = req.headers['accept-encoding'] || '';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-cache');

        if (shouldGzip(filePath) && acceptEncoding.includes('gzip')) {
          res.setHeader('Content-Encoding', 'gzip');
          zlib.gzip(data, (err, compressed) => {
            if (err) {
              res.writeHead(500);
              res.end('Server error');
              return;
            }
            res.writeHead(200);
            res.end(compressed);
          });
        } else {
          res.writeHead(200);
          res.end(data);
        }
      });
      return;
    }

    // File exists, serve it
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const acceptEncoding = req.headers['accept-encoding'] || '';

    res.setHeader('Content-Type', contentType);
    
    // Set cache headers for assets
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (['.js', '.css'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
        return;
      }

      if (shouldGzip(filePath) && acceptEncoding.includes('gzip')) {
        res.setHeader('Content-Encoding', 'gzip');
        zlib.gzip(data, (err, compressed) => {
          if (err) {
            res.writeHead(500);
            res.end('Server error');
            return;
          }
          res.writeHead(200);
          res.end(compressed);
        });
      } else {
        res.writeHead(200);
        res.end(data);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
