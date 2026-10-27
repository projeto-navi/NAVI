// Servidor estático mínimo para os testes (sem dependências).
// Comprime texto com gzip quando o navegador aceita, como o Netlify faz (medidas de desempenho realistas).
// Uso: node testes/servidor.mjs [pasta] [porta] [--h2]   — padrão: site-acessivel, 4173
//   --h2: HTTPS com HTTP/2, como o Netlify (todas as requisições numa conexão só). Usa um certificado
//   descartável feito na hora com o openssl; o navegador precisa ignorar o erro de certificado.
import { createServer } from 'node:http';
import { createSecureServer } from 'node:http2';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const h2 = process.argv.includes('--h2');
const posicionais = process.argv.slice(2).filter(a => !a.startsWith('--'));
const pasta = resolve(raizRepo, posicionais[0] || 'site-acessivel');
const porta = Number(posicionais[1] || process.env.PORTA || 4173);

function certificadoDescartavel() {
  const d = mkdtempSync(join(tmpdir(), 'navi-cert-'));
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(d, 'chave.pem'),
    '-out', join(d, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  return { key: readFileSync(join(d, 'chave.pem')), cert: readFileSync(join(d, 'cert.pem')), allowHTTP1: true };
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.glb': 'model/gltf-binary'
};

async function responder(req, res) {
  try {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let arquivo = normalize(join(pasta, caminho));
    if (!arquivo.startsWith(pasta)) { res.writeHead(403).end(); return; }
    if ((await stat(arquivo).catch(() => null))?.isDirectory()) arquivo = join(arquivo, 'index.html');
    let corpo = await readFile(arquivo);
    const tipo = TIPOS[extname(arquivo)] || 'application/octet-stream';
    const cabecalhos = { 'Content-Type': tipo, 'Cache-Control': 'no-store', 'Vary': 'Accept-Encoding' };
    if (/^(text\/|application\/(json|manifest)|image\/svg)/.test(tipo) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      corpo = gzipSync(corpo);
      cabecalhos['Content-Encoding'] = 'gzip';
    }
    res.writeHead(200, cabecalhos);
    res.end(corpo);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
}

(h2 ? createSecureServer(certificadoDescartavel(), responder) : createServer(responder))
  .listen(porta, '127.0.0.1', () => console.log(`Navi em ${h2 ? 'https' : 'http'}://127.0.0.1:${porta}/ (pasta ${pasta}${h2 ? ', HTTP/2' : ''})`));
