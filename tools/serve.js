// Мини-сервер для проверки игры на компьютере: node tools/serve.js → http://localhost:5173
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const port = process.env.PORT || 5173;
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // Сохранение картинок из tools/make-assets.html в папку promo/ (только PNG с простым именем).
  const save = url.match(/^\/save\/([\w-]+\.png)$/);
  if (req.method === 'POST' && save) {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.mkdirSync(path.join(root, 'promo'), { recursive: true });
      fs.writeFileSync(path.join(root, 'promo', save[1]), Buffer.concat(chunks));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  const file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log(`Игра: http://localhost:${port}`));
