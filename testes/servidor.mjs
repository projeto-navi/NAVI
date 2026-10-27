// Servidor estático mínimo para os testes (sem dependências).
// Uso: node testes/servidor.mjs [pasta] [porta]   — padrão: site-acessivel, 4173
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = resolve(raizRepo, process.argv[2] || 'site-acessivel');
const porta = Number(process.argv[3] || process.env.PORTA || 4173);

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary'
};

createServer(async (req, res) => {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arquivo = normalize(join(pasta, caminho));
    if (!arquivo.startsWith(pasta)) { res.writeHead(403).end(); return; }
    if ((await stat(arquivo).catch(() => null))?.isDirectory()) arquivo = join(arquivo, 'index.html');
    const corpo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}).listen(porta, '127.0.0.1', () => console.log(`Navi em http://127.0.0.1:${porta}/ (pasta ${pasta})`));
