// Depois de "npx cap add android": permissões de Bluetooth e localização, chave de teste fixa e ícone.
// Uso: node scripts/ajustar-android.mjs [pasta do projeto Android, padrão android/]. Pode rodar mais de uma vez.
import { existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const android = resolve(process.argv[2] || join(app, 'android'));
const main = join(android, 'app/src/main');
const exigir = f => { if (!existsSync(f)) { console.error(`ajustar-android: não encontrei ${f}. Rode "npx cap add android" antes.`); process.exit(1); } return f; };

// 1. Permissões. BLUETOOTH_SCAN SEM neverForLocation: com essa marca o Android esconde beacons da busca.
const manifesto = exigir(join(main, 'AndroidManifest.xml'));
let m = readFileSync(manifesto, 'utf8');
const PERMISSOES = [
  '<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />',
  '<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-feature android:name="android.hardware.bluetooth_le" android:required="false" />'
];
const faltam = PERMISSOES.filter(p => !m.includes(p.match(/android:name="([^"]+)"/)[0]));
if (faltam.length) m = m.replace(/\n(\s*)<application/, (t, esp) => '\n' + faltam.map(p => esp + p).join('\n') + '\n\n' + esp + '<application');
writeFileSync(manifesto, m);

// 2. Chave de teste fixa: cada APK novo instala por cima do anterior. Só para testes.
const gradle = exigir(join(android, 'app/build.gradle'));
let g = readFileSync(gradle, 'utf8');
if (!g.includes('signingConfigs.teste')) {
  g = g.replace(/android\s*\{\n/, t => t +
    "    signingConfigs {\n        teste {\n            storeFile file('../../chave-teste/navi-teste.jks')\n            storePassword 'navi-teste'\n            keyAlias 'navi-teste'\n            keyPassword 'navi-teste'\n        }\n    }\n");
  g = g.replace(/buildTypes\s*\{\n/, t => t + '        debug {\n            signingConfig signingConfigs.teste\n        }\n');
  writeFileSync(gradle, g);
}

// 3. Ícone do Navi em todas as densidades (sem o ícone adaptativo padrão do Capacitor).
const icone = resolve(app, '..', 'site-acessivel/img/icone-192.png');
const res = join(main, 'res');
for (const pasta of readdirSync(res).filter(p => /^mipmap-/.test(p))) {
  if (pasta.startsWith('mipmap-anydpi')) { rmSync(join(res, pasta), { recursive: true, force: true }); continue; }
  for (const nome of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) copyFileSync(icone, join(res, pasta, nome));
}
console.log('Projeto Android ajustado: permissões, chave de teste e ícone.');
