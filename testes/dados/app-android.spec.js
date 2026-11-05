// Projeto do app Android (Capacitor) e geração do APK no GitHub Actions.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');

const RAIZ = path.join(__dirname, '..', '..');
const APP = path.join(RAIZ, 'app-android');
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

test.describe('app-android', () => {
  test('capacitor.config: id, nome e pasta do site', () => {
    const c = JSON.parse(ler('app-android/capacitor.config.json'));
    expect(c).toMatchObject({ appId: 'br.com.projetonavi.navi', appName: 'Navi', webDir: 'www' });
  });

  test('package.json pede Capacitor 8 e o plugin de Bluetooth 8', () => {
    const p = JSON.parse(ler('app-android/package.json'));
    const todas = { ...p.dependencies, ...p.devDependencies };
    for (const d of ['@capacitor/core', '@capacitor/android', '@capacitor/cli', '@capacitor-community/bluetooth-le']) expect(todas[d], d).toMatch(/^\^8/);
    expect(p.scripts['copiar-site']).toBeTruthy();
    expect(p.scripts['ajustar-android']).toBeTruthy();
  });

  test('o workflow monta o APK de teste e publica o artefato navi-teste', () => {
    const w = ler('.github/workflows/apk.yml');
    for (const t of ['workflow_dispatch', 'app/android', 'assembleDebug', 'upload-artifact', 'navi-teste', 'npx cap add android', 'ajustar-android']) expect(w, t).toContain(t);
  });

  test('o workflow também publica o APK na branch apk-teste, só com a versão mais recente', () => {
    const w = ler('.github/workflows/apk.yml');
    expect(w).toMatch(/git push -f .* apk-teste/);
  });

  test('só a etapa de publicar escreve no repositório; a montagem (que instala pacotes do npm) só lê', () => {
    const w = ler('.github/workflows/apk.yml');
    const [antes, publicar] = w.split(/\n  publicar:\n/);
    expect(publicar, 'job publicar').toBeTruthy();
    expect(antes).toMatch(/^permissions:\n  contents: read$/m);
    expect(antes).not.toContain('contents: write');
    expect(antes).not.toContain('git push');
    expect(publicar).toContain('needs: apk');
    expect(publicar).toContain('contents: write');
    expect(publicar).not.toContain('npm install');
    expect(publicar).toContain('actions/download-artifact');
  });

  test('copiar-site leva o site inteiro para www/', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'navi-www-'));
    execFileSync(process.execPath, [path.join(APP, 'scripts/copiar-site.mjs'), tmp]);
    for (const f of ['index.html', 'mapa.html', 'beacons.html', 'js/beacons.js', 'locais/predio-teste/beacons.js']) expect(fs.existsSync(path.join(tmp, f)), f).toBe(true);
  });

  test('ajustar-android: permissões sem neverForLocation, chave de teste e ícone', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'navi-android-'));
    const main = path.join(tmp, 'app/src/main');
    fs.mkdirSync(path.join(main, 'res/mipmap-hdpi'), { recursive: true });
    fs.mkdirSync(path.join(main, 'res/mipmap-anydpi-v26'), { recursive: true });
    fs.writeFileSync(path.join(main, 'res/mipmap-anydpi-v26/ic_launcher.xml'), '<adaptive-icon/>');
    fs.writeFileSync(path.join(main, 'res/mipmap-hdpi/ic_launcher.png'), 'x');
    fs.writeFileSync(path.join(main, 'AndroidManifest.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application android:label="@string/app_name">\n    </application>\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n');
    fs.writeFileSync(path.join(tmp, 'app/build.gradle'),
      "apply plugin: 'com.android.application'\n\nandroid {\n    namespace \"br.com.projetonavi.navi\"\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n}\n");
    const rodar = () => execFileSync(process.execPath, [path.join(APP, 'scripts/ajustar-android.mjs'), tmp]);
    rodar();
    rodar(); // rodar de novo não duplica nada
    const m = fs.readFileSync(path.join(main, 'AndroidManifest.xml'), 'utf8');
    for (const p of ['BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
      expect(m.split(`android.permission.${p}"`).length - 1, p).toBe(1);
    }
    expect(m).not.toContain('neverForLocation');
    expect(m).toContain('android.hardware.bluetooth_le');
    const g = fs.readFileSync(path.join(tmp, 'app/build.gradle'), 'utf8');
    expect(g.split('signingConfigs {').length - 1).toBe(1);
    expect(g).toContain("storeFile file('../../chave-teste/navi-teste.jks')");
    expect(g).toMatch(/debug \{\s*signingConfig signingConfigs\.teste/);
    expect(fs.existsSync(path.join(main, 'res/mipmap-anydpi-v26'))).toBe(false);
    const icone = fs.readFileSync(path.join(main, 'res/mipmap-hdpi/ic_launcher.png'));
    expect(icone.equals(fs.readFileSync(path.join(RAIZ, 'site-acessivel/img/icone-192.png')))).toBe(true);
    expect(fs.existsSync(path.join(main, 'res/mipmap-hdpi/ic_launcher_round.png'))).toBe(true);
  });

  test('a chave de teste abre com a senha navi-teste e tem o alias navi-teste', () => {
    const saida = execFileSync('keytool', ['-list', '-keystore', path.join(APP, 'chave-teste/navi-teste.jks'), '-storepass', 'navi-teste'], { encoding: 'utf8' });
    expect(saida).toContain('navi-teste');
  });
});
