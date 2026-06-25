/* server.js */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Decode URL to handle Turkish characters in file paths if any
  let decodedUrl = decodeURIComponent(req.url);
  let filePath = '.' + decodedUrl;
  
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Sayfa Bulunamadi</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Sistem Hatası: ${error.code} ..\n`);
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        // Disable cache for active development/refreshing
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`--------------------------------------------------`);
  console.log(`Neslihan Calisma Platformu Sunucusu Aktif!`);
  console.log(`Adres: http://localhost:${PORT}`);
  console.log(`Durdurmak icin konsolda Ctrl+C tuslarina basin.`);
  console.log(`--------------------------------------------------`);
});
