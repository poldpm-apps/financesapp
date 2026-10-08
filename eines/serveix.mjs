/**
 * Finances — serveix una carpeta per mirar-la al navegador
 *
 *   node eines/serveix.mjs [carpeta] [port]      per defecte: .mirall 4175
 *
 * El mirall és un fitxer estàtic, però el navegador no deixa obrir-lo des del
 * disc amb totes les peces —el treballador de servei, per exemple, demana
 * http—. Això el serveix a localhost i prou: no surt de la màquina.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';

const ARREL = path.resolve(process.argv[2] || '.mirall');
const PORT = Number(process.argv[3] || 4175);
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
                '.svg': 'image/svg+xml', '.json': 'application/json',
                '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png' };

http.createServer((req, res) => {
  const cami = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(ARREL, cami);
  if (!f.startsWith(ARREL)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no hi és'); }
  res.writeHead(200, { 'Content-Type': TIPUS[path.extname(f)] || 'application/octet-stream',
                       'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('Servint ' + ARREL + ' a http://localhost:' + PORT));
