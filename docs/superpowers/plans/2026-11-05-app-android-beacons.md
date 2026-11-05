# App Android do Navi com beacons — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um APK de teste (Android) que abre o Navi, liga Bluetooth, localização e permissão com explicação, mostra os beacons por perto e diz "Você está perto de X".

**Architecture:** O site continua estático; três scripts novos (`beacons.js` puro, `beacons-app.js` ponte com o plugin, `beacons-ui.js` telas) só ligam dentro do app. `app-android/` é um projeto Capacitor 8 sem a pasta `android/`: o GitHub Actions gera o Android, aplica permissões, ícone e chave de teste, e publica `navi-teste.apk`.

**Tech Stack:** HTML/CSS/JS puro; Capacitor 8; `@capacitor-community/bluetooth-le` 8; GitHub Actions (Node 22, Java 21, Android SDK do runner); Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-app-android-beacons-design.md`

## Global Constraints

- Site sem build, abre por `file://` e offline; no navegador comum nada novo aparece e nenhum erro novo surge.
- Motor de rotas (`js/rotas.js`) não muda.
- Nada sobre a localização da pessoa sai do aparelho (RN55, RN07, RN73 proposta).
- A rota nunca muda sem a pessoa tocar (RN74 proposta).
- Textos exatos: "O Bluetooth foi desligado. A busca está pausada." / "A localização foi desligada. A busca está pausada."; "Encontrar onde você está"; "O Navi usa o Bluetooth e a localização do celular só para perceber os beacons do prédio. Nada sai do seu celular."; "Ligado"/"Ligar o Bluetooth"; "Ligada"/"Ligar a localização"; "Permitida"/"Permitir"; "Começar a procurar"; "Parar de procurar"; "Você está perto de: <nome> (<andar>)"; "Sair daqui"; "Recalcular daqui"; "Beacons por perto"; "Copiar números"; "não cadastrado".
- UUID padrão: `FDA50693-A4E2-4FB1-AFCF-C6EB07647825`; raio padrão 2 m; sai acima de 2 × raio ou após 8 s sem leitura; entra após 2 leituras seguidas ≤ raio; distância `10 ^ ((potencia − rssi) / 25)`; potência padrão −59; suavização exponencial com peso 0,3 para a leitura nova.
- Permissões Android: `BLUETOOTH_SCAN` sem `neverForLocation`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`; `initialize({ androidNeverForLocation: false })`.
- appId `br.com.projetonavi.navi`, appName `Navi`; artefato `navi-teste.apk`; chave `app-android/chave-teste/navi-teste.jks`, alias `navi-teste`, senha `navi-teste` (só testes).
- Alvos de toque ≥ 48 px; tudo funciona com leitor de tela.
- Commits com as linhas de atribuição da sessão; push só na branch `app/android`.

## Review Focus

1. Dois beacons quase à mesma distância → o "perto de" não pode trocar a cada leitura. Regra: o atual só passa para outro beacon quando o outro já está "perto" e ao menos 0,5 m mais próximo (teste na Task 1).
2. Leitura com RSSI 0 ou potência 127 ("indisponível") → RSSI 0 é ignorado; potência 127 ou ausente usa −59 (Task 1).
3. "Começar a procurar" tocado duas vezes, ou página que some e volta → um único ouvinte e uma única busca; nada de leituras em dobro (Task 2).
4. Beacon do lugar que já é o destino, na Página do Mapa → "Você chegou: <nome>", sem botão; beacon do lugar que já é a partida → nenhuma faixa (Task 3).
5. Fora do app (navegador, `file://`) → nenhum script tenta o plugin, nenhum erro no console, nenhuma parte nova (Task 3).

---

### Task 1: Lógica dos beacons e lista do prédio

**Files:**
- Create: `site-acessivel/js/beacons.js`
- Create: `site-acessivel/locais/predio-teste/beacons.js`
- Modify: `testes/apoio/local-node.js` (carregar `beacons.js` quando existir, sem quebrar locais que não têm)
- Test: `testes/dados/beacons.spec.js`

**Interfaces:**
- Produces (`window.NaviBeacons` / `module.exports`):
  - `lerIBeacon(dados) → {uuid: string (maiúsculo, com hífens), major: number, minor: number, potencia: number} | null`, em que `dados` é o `manufacturerData` (objeto com chave de empresa `"76"` ou `"004c"`/`"0x004c"`, valor hex com ou sem espaços, ou `DataView`).
  - `distancia(rssi: number, potencia?: number) → number` (metros).
  - `criarRastreador({ uuid, raioPadrao, lista: [{major, minor, lugar, raio?}], agora?: () => ms }) → { registrar({uuid, major, minor, potencia, rssi}), atual() → {lugar, distancia} | null, todos() → [{uuid, major, minor, rssi, distancia, lugar|null, vistoEm}] }`.
  - `validarLista(beacons, local) → string[]` (erros: lugar inexistente, major/minor repetido, UUID mal formado).
- Produces: `naviLocal("predio-teste").beacons = { uuid, raioPadrao: 2, lista: [...] }` com os 8 itens da especificação (minor 1 = PCT_P01_L0001 … minor 8 = PCT_P03_L0001).

- [ ] **Step 1: Write the failing tests** em `testes/dados/beacons.spec.js`:
  - `lerIBeacon` com o objeto `{ "76": "0215FDA50693A4E24FB1AFCFC6EB0764782500010002C5" }` → `{uuid:'FDA50693-A4E2-4FB1-AFCF-C6EB07647825', major:1, minor:2, potencia:-59}`; o mesmo com espaços entre bytes e como `DataView` → mesmo resultado; empresa 6 (Microsoft) → `null`; prefixo `0216` → `null`; 22 bytes (curto) → `null`.
  - `distancia(-59, -59)` ≈ 1; `distancia(-84, -59)` ≈ 10 (±0,01); potência `127` e `undefined` usam −59.
  - Rastreador (relógio falso): uma leitura a 1 m → `atual()` `null`; segunda → `{lugar:'PCT_P01_L0007'}`; leituras a 5 m → continua até a suavização passar de 4 m, depois `null`; sem leitura por 8001 ms → `null`; minor 99 → nunca `atual`, mas aparece em `todos()` com `lugar: null`; RSSI 0 ignorado.
  - Review Focus 1: A perto a 1,8 m e B a 1,6 m (diferença 0,2) → continua A; B a 1,0 m → passa para B.
  - `validarLista` do prédio → `[]`; com lugar `'NAO_EXISTE'` e minor repetido → 2 erros.
- [ ] **Step 2: Run** `PORTA=4391 npx playwright test --project=dados testes/dados/beacons.spec.js` — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** `js/beacons.js` (padrão dos outros módulos: IIFE, `module.exports` no Node, `window.NaviBeacons` no navegador) e `locais/predio-teste/beacons.js`. A suavização guarda o RSSI suavizado por beacon (`major:minor`); a distância usa o RSSI suavizado.
- [ ] **Step 4: Run** o mesmo comando — Expected: PASS; depois `--project=dados` inteiro — Expected: tudo passa.
- [ ] **Step 5: Commit** `feat(app): leitura de iBeacon, distância e "perto de" (beacons.js)`.

### Task 2: Ponte com o Bluetooth do celular

**Files:**
- Create: `site-acessivel/js/beacons-app.js`
- Create: `testes/apoio/bluetooth-falso.js` (plugin falso com o formato da ponte nativa; exporta também o texto de um script para `addInitScript`)
- Test: `testes/dados/beacons-app.spec.js`

**Interfaces:**
- Consumes: `NaviBeacons.lerIBeacon` (Task 1).
- Produces (`window.NaviBeaconsApp`):
  - `criar({ plugin?, armazenamento?, documento? }) → app`; sem `plugin`, procura `Capacitor.Plugins.BluetoothLe` e, se não houver, `Capacitor.registerPlugin('BluetoothLe')`, só quando `Capacitor.isNativePlatform()` é verdadeiro.
  - `app.disponivel() → boolean`
  - `app.situacao() → Promise<{ bluetooth: boolean, localizacao: boolean, permissao: 'permitida'|'negada'|'perguntar' }>` (ponte devolve `{value}` em `isEnabled`/`isLocationEnabled`; permissão por `checkPermissions()` quando existir, senão `'perguntar'` até `permitir()` dar certo)
  - `app.permitir() → Promise<boolean>` (`initialize({ androidNeverForLocation: false })`; rejeição → `false` e permissão `'negada'`)
  - `app.ligarBluetooth() → Promise<void>` (`requestEnable`), `app.ligarLocalizacao() → Promise<void>` (`openLocationSettings`)
  - `app.comecar(aoLer: (leitura:{uuid,major,minor,potencia,rssi}) => void) → Promise<void>` (`addListener('onScanResult', …)` + `requestLEScan({ allowDuplicates: true, scanMode: 2 })`; só iBeacons passam para `aoLer`; `potencia` do pacote, ou `txPower` do resultado se o pacote não tiver)
  - `app.parar() → Promise<void>` (`stopLEScan` + remove o ouvinte)
  - `app.procurando() → boolean`
  - `app.aoMudarSituacao(cb: (situacao) => void)`: enquanto procura, confere `situacao()` a cada 5 s; se Bluetooth ou localização desligarem, pausa a busca e chama `cb`; quando voltarem, recomeça e chama `cb` de novo.
  - Escolha guardada: `armazenamento['navi-beacons'] = '1'` ao começar, removida ao parar; `app.lembrado() → boolean`.
  - Página oculta (`documento.visibilityState === 'hidden'`) → para a busca sem apagar a escolha; visível de novo → recomeça se estava procurando.
- Produces (`bluetooth-falso.js`): `criarPluginFalso({ bluetooth=true, localizacao=true, permissao='permitida' }) → plugin` com `emitir(resultado)`, `definir({bluetooth?, localizacao?, permissao?})`, `chamadas[]`, e os mesmos métodos da ponte; `SCRIPT_INIT` (string) que instala `window.Capacitor = { isNativePlatform: () => true, Plugins: { BluetoothLe } }` e `window.__bleFalso` para os testes de comportamento.

- [ ] **Step 1: Write the failing tests** (`beacons-app.spec.js`, plugin falso no Node):
  - sem `Capacitor` → `disponivel()` `false`, nenhum método do plugin chamado.
  - `situacao()` com Bluetooth desligado → `{bluetooth:false, localizacao:true, permissao:'permitida'}`.
  - `permitir()` chama `initialize` com `{androidNeverForLocation:false}`; plugin que rejeita → `false` e `situacao().permissao === 'negada'`.
  - `comecar` → `requestLEScan` com `{allowDuplicates:true, scanMode:2}`; `emitir` de um iBeacon chega a `aoLer` com `rssi`; `emitir` de outra empresa não chega.
  - Review Focus 3: `comecar` duas vezes → um `addListener` e um `requestLEScan`; cada `emitir` chega uma vez.
  - página oculta → `stopLEScan`; visível → `requestLEScan` de novo; `parar()` → `procurando()` `false` e `navi-beacons` apagado.
  - procurando, o falso passa a `bluetooth:false` → depois de 5 s (relógio falso) `stopLEScan` e `cb` com `{bluetooth:false}`; volta a `true` → `requestLEScan` de novo.
- [ ] **Step 2: Run** `PORTA=4391 npx playwright test --project=dados testes/dados/beacons-app.spec.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `js/beacons-app.js` e `testes/apoio/bluetooth-falso.js`.
- [ ] **Step 4: Run** — Expected: PASS; `--project=dados` inteiro passa.
- [ ] **Step 5: Commit** `feat(app): ponte com o Bluetooth do celular (beacons-app.js)`.

### Task 3: Telas do app nas páginas públicas

**Files:**
- Create: `site-acessivel/js/beacons-ui.js`, `site-acessivel/css/beacons.css`
- Modify: `site-acessivel/index.html`, `site-acessivel/mapa.html` (scripts `beacons.js`, `beacons-app.js`, `beacons-ui.js` com `defer`; estilo `css/beacons.css`; em `index.html`, `<div id="beacons-area"></div>` logo antes do rodapé)
- Modify: `site-acessivel/js/ui.js` (link "Beacons por perto" na seção Rotas das Preferências, só quando `NaviBeaconsApp.criar().disponivel()`)
- Modify: `site-acessivel/sw.js` (PRECACHE dos arquivos novos e de `locais/predio-teste/beacons.js`; nova `VERSAO`)
- Test: `testes/comportamento/beacons-app.spec.js`

**Interfaces:**
- Consumes: `NaviBeacons` (Task 1), `NaviBeaconsApp`, `bluetooth-falso.js` `SCRIPT_INIT` (Task 2).
- Produces: `NaviBeaconsUI.ligar({ pagina: 'rota'|'mapa', local, slug, origem?: () => string|null, destino?: () => string|null, anunciar: (texto) => void }) → { parar() }`. Só faz algo se o app está disponível; carrega `locais/<slug>/beacons.js` por `<script>` (sem lista → nenhuma parte nova). Chamado por `pagina-rota.js` e `pagina-mapa.js` depois de montarem a página.
- "Sair daqui" → `location.href = 'index.html?origem=' + lugar` (RN59: abre a Página de Rota com a partida). "Recalcular daqui" → `location.replace('mapa.html?origem=' + lugar + '&destino=' + destino)`.
- Página de Rota: cartão em `#beacons-area` com o painel (três linhas + "Começar a procurar"/"Parar de procurar") e, quando há `atual()`, "Você está perto de: <nome> (<descrição do andar>)" + "Sair daqui". Página do Mapa: faixa fixa logo abaixo do topo (`#beacons-faixa`, `role="status"`), só quando há `atual()`.
- Texto de andar: o mesmo de `NaviCategorias.descricao(lugar, local)` usado no site.

- [ ] **Step 1: Write the failing tests** (`beacons-app.spec.js`, `addInitScript(SCRIPT_INIT)`, emissões por `page.evaluate(() => __bleFalso.emitir(...))`):
  - no navegador sem o script → `#beacons-area` vazio, nenhum link "Beacons por perto" nas Preferências, nenhum erro (`N.errosReais`) (Review Focus 5).
  - com Bluetooth desligado → "Ligar o Bluetooth" visível e "Começar a procurar" desativado; tocar → `requestEnable` chamado; depois de ligar, a linha mostra "Ligado".
  - três em ordem → "Começar a procurar" → duas emissões do minor 2 a −59 → "Você está perto de: Elevador 1" visível; "Sair daqui" → URL `index.html?origem=PCT_P01_L0007` e a partida preenchida.
  - Página do Mapa com rota Entrada → Sala de reunião e busca lembrada → emissões do minor 5 → faixa "Você está perto de: Rampa"; "Recalcular daqui" → URL com `origem=PCT_P01_L0011&destino=PCT_P02_L0007`.
  - Review Focus 4: minor 7 (o destino) → "Você chegou: Sala de reunião", sem botão; minor 1 (a partida) → nenhuma faixa.
  - permissão negada → explicação "Configurações → Apps → Navi → Permissões" visível.
  - procurando, o falso desliga o Bluetooth (`__bleFalso.definir({bluetooth:false})`) → em até 6 s aparece "O Bluetooth foi desligado. A busca está pausada." com "Ligar o Bluetooth".
  - 360 px: sem rolagem lateral; botões novos ≥ 48 px.
- [ ] **Step 2: Run** `PORTA=4391 npx playwright test --project=computador --project=celular testes/comportamento/beacons-app.spec.js` — Expected: FAIL.
- [ ] **Step 3: Implement** `beacons-ui.js`, `beacons.css` e as ligações nas páginas, nas Preferências e no `sw.js`.
- [ ] **Step 4: Run** o mesmo comando — Expected: PASS; depois a suíte inteira `PORTA=4391 npx playwright test` — Expected: tudo passa (inclusive `pwa-arquivos`).
- [ ] **Step 5: Commit** `feat(app): painel de beacons e "Você está perto de" nas páginas`.

### Task 4: Tela de teste "Beacons por perto"

**Files:**
- Create: `site-acessivel/beacons.html`, `site-acessivel/js/pagina-beacons.js`
- Modify: `site-acessivel/sw.js` (PRECACHE)
- Modify: `testes/dados/pwa-arquivos.spec.js` (incluir `beacons.html` na checagem de páginas)
- Test: `testes/comportamento/beacons-app.spec.js` (novo `describe`)

**Interfaces:**
- Consumes: `NaviBeacons.criarRastreador().todos()`, `NaviBeaconsApp` (Tasks 1–2).
- Produces: página com topo igual ao das outras, lista (`<ul aria-label="Beacons por perto">`) atualizada a cada 1 s, um item por beacon: "UUID FDA50693…, major 1, minor 2", "Sinal: −59 dBm", "Distância: ~1,0 m", lugar ou "não cadastrado", "visto há N s"; botão "Copiar números" (copia linhas `uuid,major,minor,rssi` para a área de transferência e anuncia "Números copiados"). Fora do app: "Esta tela funciona só no app do Navi." e link para voltar.

- [ ] **Step 1: Write the failing tests:** com o plugin falso, emissões dos minors 2 e 99 → dois itens, o de 99 com "não cadastrado"; "Copiar números" → área de transferência com 2 linhas (permissão `clipboard-read/write` no contexto); sem o app → a frase "Esta tela funciona só no app do Navi."
- [ ] **Step 2: Run** `PORTA=4391 npx playwright test --project=computador testes/comportamento/beacons-app.spec.js -g "Beacons por perto"` — Expected: FAIL.
- [ ] **Step 3: Implement** `beacons.html` e `pagina-beacons.js`; se a busca não estiver ligada, a página oferece "Começar a procurar" (mesmo fluxo de permissões do painel, reaproveitando `NaviBeaconsUI` ou o próprio `NaviBeaconsApp`).
- [ ] **Step 4: Run** — Expected: PASS; `--project=dados` passa.
- [ ] **Step 5: Commit** `feat(app): tela de teste Beacons por perto`.

### Task 5: Projeto Capacitor e geração do APK no GitHub

**Files:**
- Create: `app-android/package.json`, `app-android/capacitor.config.json`, `app-android/scripts/copiar-site.mjs`, `app-android/scripts/ajustar-android.mjs`, `app-android/chave-teste/navi-teste.jks`, `app-android/LEIA-ME.md`, `app-android/.gitignore` (`node_modules/`, `www/`, `android/`)
- Create: `.github/workflows/apk.yml`
- Test: `testes/dados/app-android.spec.js`

**Interfaces:**
- Consumes: o site inteiro (`site-acessivel/`).
- Produces: artefato `navi-teste` contendo `navi-teste.apk`.
- `package.json`: dependências `@capacitor/core`, `@capacitor/android`, `@capacitor-community/bluetooth-le` em `^8`; devDependency `@capacitor/cli` `^8`; scripts `copiar-site` e `ajustar-android`.
- `copiar-site.mjs`: apaga e recria `www/` com o conteúdo de `../site-acessivel` (sem `node_modules`).
- `ajustar-android.mjs` (roda depois de `npx cap add android`): no `AndroidManifest.xml` acrescenta as 4 permissões (sem `neverForLocation`) e `<uses-feature android:name="android.hardware.bluetooth_le" android:required="false"/>`; em `android/app/build.gradle` acrescenta `signingConfigs.debug` apontando para `../../chave-teste/navi-teste.jks` (alias e senhas `navi-teste`); copia `site-acessivel/img/icone-192.png` para `mipmap-*/ic_launcher.png` e `ic_launcher_round.png` e apaga `mipmap-anydpi-v26/`. Falha com mensagem clara se algum arquivo esperado não existir.
- `apk.yml`: `on: push` (branch `app/android`, caminhos `app-android/**`, `site-acessivel/**`, `.github/workflows/apk.yml`) e `workflow_dispatch`; nome "APK de teste"; `actions/setup-node` 22, `actions/setup-java` 21 (temurin); em `app-android/`: `npm install`, `npm run copiar-site`, `npx cap add android`, `npm run ajustar-android`, `npx cap sync android`, `cd android && ./gradlew assembleDebug`; renomeia `app-debug.apk` para `navi-teste.apk`; `actions/upload-artifact` com nome `navi-teste`, `retention-days: 30`.

- [ ] **Step 1: Write the failing test** (`app-android.spec.js`): `capacitor.config.json` tem `appId 'br.com.projetonavi.navi'`, `appName 'Navi'`, `webDir 'www'`; `package.json` pede as 4 dependências em `^8`; `apk.yml` contém `assembleDebug`, `upload-artifact` e `navi-teste`; `ajustar-android.mjs` aplicado a um `AndroidManifest.xml` e `build.gradle` mínimos gravados no teste (pasta temporária) produz as 4 permissões, nenhum `neverForLocation` e o `signingConfigs`; a chave existe e `keytool -list` com a senha `navi-teste` mostra o alias `navi-teste`.
- [ ] **Step 2: Run** `PORTA=4391 npx playwright test --project=dados testes/dados/app-android.spec.js` — Expected: FAIL.
- [ ] **Step 3: Implement** os arquivos; gerar a chave com `keytool -genkeypair -keystore app-android/chave-teste/navi-teste.jks -alias navi-teste -storepass navi-teste -keypass navi-teste -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Navi teste"`. `ajustar-android.mjs` recebe a pasta do projeto Android por argumento (padrão `android`), para o teste usar a pasta temporária.
- [ ] **Step 4: Run** o teste — Expected: PASS. Depois `git push` e acompanhar: `gh run list --workflow apk.yml --branch app/android -L 1` até terminar; `gh run view <id> --log-failed` em caso de erro, corrigir e repetir. Expected: execução verde com o artefato `navi-teste`.
- [ ] **Step 5: Baixar e conferir** `gh run download <id> -n navi-teste -D <scratchpad>/apk`; `unzip -l navi-teste.apk` lista `assets/public/index.html` e `assets/public/js/beacons.js`; `aapt`/`apkanalyzer` não existem aqui, então conferir permissões lendo o manifesto binário com `unzip -p … AndroidManifest.xml | strings | grep -c BLUETOOTH_SCAN` ≥ 1. Expected: os três conferem.
- [ ] **Step 6: Commit** `feat(app): projeto Capacitor e APK de teste pelo GitHub Actions` (os commits de correção do CI entram com a mesma mensagem-base).

### Task 6: Regras, roteiro e entrega

**Files:**
- Modify: `ferramentas/documentos/doc4a6.js` (Documento 04 v1.5: grupo "App e beacons" com RN71–RN74 em X; nota sobre "Fora do escopo"; histórico 1.5); regenerar `documentos/04-Regras-de-Negocio.docx` e `.publicar/04.md`; gravar no Project (`04-Regras-de-Negocio.docx`)
- Create: `docs/kaizen/app-beacons-roteiro.md` (roteiro, tabela de minors, ficha de retorno e limitações, copiados da especificação)
- Modify: `site-acessivel/LEIA-ME.txt` (seção "App Android e beacons")

- [ ] **Step 1:** Gerar o Documento 04 (`cd ferramentas/documentos && node doc4a6.js 04`) e conferir no `.md` que RN71–RN74 aparecem como "aguardando aprovação". Expected: 4 ocorrências.
- [ ] **Step 2:** Suíte completa `PORTA=4391 npx playwright test`. Expected: tudo passa (os testes de axe pulam sem o pacote).
- [ ] **Step 3:** Commit `docs(app): Documento 04 v1.5 (RN71–RN74) e roteiro de teste do app`; push; confirmar nova execução verde do APK e baixá-la.
- [ ] **Step 4:** Enviar `navi-teste.apk` e o roteiro na conversa.
