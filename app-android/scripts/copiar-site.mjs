// Copia o site (../site-acessivel) para a pasta do app (www/ ou a pasta passada como argumento).
// O site continua sem build: o app guarda uma cópia exata dele.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origem = resolve(app, '..', 'site-acessivel');
const destino = resolve(process.argv[2] || join(app, 'www'));
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
cpSync(origem, destino, { recursive: true, filter: f => !/node_modules/.test(f) });
console.log(`Site copiado para ${destino}`);
