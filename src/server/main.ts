import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { attachWebSocketServer, registerGame } from '../framework/server/network/ws';
import tetrominoGame from '../games/tetromino/definition';

// Register all games
registerGame(tetrominoGame as any);

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

const server = http.createServer((req, res) => {
  const filePath = path.join(PUBLIC_DIR, req.url === '/' ? '/index.html' : req.url!);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] ?? 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Fallback to index.html for SPA routing
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
