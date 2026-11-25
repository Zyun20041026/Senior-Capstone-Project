// Alex 202384014054
/*
 * Optional local web server for Capsid Lockdown (Node built-ins only).
 * Opening index.html directly also works. I use this server while working
 * on the game because it turns off caching, so the browser always loads
 * the newest files.
 *
 * It finds the game folder by itself, so it can be started from any folder:
 *   node tools/serve.js                                (inside capsid-lockdown)
 *   node Alex-202384014054/capsid-lockdown/tools/serve.js   (from the repository)
 * Add a number at the end to use another port, e.g. `node tools/serve.js 9000`.
 * The PORT environment variable also works.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT_TEXT = process.argv[2] || process.env.PORT || '8765';
const PORT = Number(PORT_TEXT);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.json': 'application/json' };
// The command as the user typed it, for the help messages below.
const CMD = 'node ' + (path.relative(process.cwd(), __filename) || __filename);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('"' + PORT_TEXT + '" is not a port number. Try: ' + CMD + ' 9000');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad address'); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  // Only serve files inside the game folder.
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' is already in use.');
    console.error('The game may already be running: try http://127.0.0.1:' + PORT + '/');
    console.error('Or start it on another port: ' + CMD + ' ' + (PORT === 65535 ? 9000 : PORT + 1));
  } else {
    console.error('Could not start the server: ' + err.message);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Capsid Lockdown is running.');
  console.log('Open http://127.0.0.1:' + PORT + '/ in Chrome.');
  console.log('Press Ctrl+C to stop.');
});
