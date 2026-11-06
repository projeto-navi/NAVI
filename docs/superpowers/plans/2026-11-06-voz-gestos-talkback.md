# Voz com gestos do TalkBack e voz do Android — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No app, as instruções voltam a ser faladas (voz do Android) e, com a Voz ligada, o Navi usa os gestos do TalkBack (1 toque lê, 2 toques ativam, deslizar muda de item).

**Architecture:** `voz.js` escolhe o motor (nativo `TextToSpeech` → `speechSynthesis` → nenhum). `leitor-gestos.js` (novo) intercepta toques de 1 dedo na fase de captura, mantém o item selecionado, descreve itens ("nome, tipo, estado"), desenha o retângulo verde e toca sons; toques de 2 dedos passam para a página e o mapa. `leitor-celular.js` (novo) diz se o TalkBack do celular está ligado (plugin `ScreenReader`, só no app) e pausa a voz e os gestos do Navi.

**Tech Stack:** HTML/CSS/JS puro; Capacitor 8 (`@capacitor-community/text-to-speech` 8, `@capacitor/screen-reader` 8); Playwright com toque simulado.

**Spec:** `docs/superpowers/specs/2026-11-05-voz-gestos-talkback-design.md`

## Global Constraints

- Site sem build, `file://` e offline; com a Voz desligada, nada muda no uso por toque.
- Motor de rotas não muda. RN76–RN78 entram no Documento 04 (v1.7) antes do código.
- Textos exatos: tutorial "Voz ligada. Toque uma vez para ouvir um item, toque duas vezes para ativar e deslize para a direita para ir ao próximo."; botão "Ouvir como usar os gestos"; aviso "O TalkBack do celular está ligado. O Navi deixa a leitura com ele."
- Tipos: "botão", "link", "campo de edição", "caixa de seleção", "botão de opção", "botão de alternância", "aba", "título nível N", "imagem", "lista suspensa", "controle deslizante". Estados: "ativado", "desativado", "selecionado", "expandido", "recolhido", "indisponível".
- Gestos: 2 toques ≤ 300 ms; deslize ≥ 60 px, mais horizontal que vertical, em ≤ 500 ms.
- Velocidades no app: devagar 0,8, normal 1,0, rápida 1,25; `lang: 'pt-BR'`; `queueStrategy: 0`.
- Retângulo: contorno 3 px #4CAF50, `pointer-events: none`, acima de tudo.

## Review Focus

1. Voz ligada e a pessoa digita num campo: o teclado na tela e a digitação funcionam (o campo recebe foco no toque duplo) — Task 3.
2. Item selecionado some da página (render novo): o próximo deslize recomeça do primeiro item, sem erro — Task 3.
3. 2 dedos no mapa com a Voz ligada: o mapa ainda se move (o primeiro dedo, que foi interceptado, é reenviado ao mapa quando o segundo chega) — Task 4.
4. TalkBack do celular ligado: nenhum toque é interceptado e nada é falado pelo Navi — Task 4.
5. Voz desligada: 1 toque continua ativando botões (regressão) — Task 3.

---

### Task 1: Regras no Documento 04 (v1.7)

**Files:** Modify `ferramentas/documentos/doc4a6.js`; regenerar `documentos/04-Regras-de-Negocio.docx`, `.publicar/04.md`; gravar no Project.

- [ ] **Step 1:** Grupo "Voz e gestos" com RN76, RN77, RN78 (textos da spec, situação X); versão "1.7 — 06/11/2026"; histórico 1.7; nota "Aguardam aprovação" incluindo RN76–RN78.
- [ ] **Step 2:** `cd ferramentas/documentos && node doc4a6.js 04` — Expected: `ok 4-6 …`; `.publicar/04.md` com 3 ocorrências de RN76–RN78 ou mais.
- [ ] **Step 3:** Commit `docs(voz): Documento 04 v1.7 (RN76–RN78)`.

### Task 2: Motor de voz e TalkBack do celular

**Files:** Modify `site-acessivel/js/voz.js`; Create `site-acessivel/js/leitor-celular.js`; Test `testes/dados/voz.spec.js`.

**Interfaces:**
- Produces: `NaviVoz.criar({ regiao, avisoEl, prefs, motor? , leitorCelular? })` com `motor` = `{ tipo: 'nativo'|'navegador'|'nenhum', falar(texto, {rate}) → Promise|void, parar(), pausar?(), continuar?() }`; sem `motor`, `NaviVoz.motorPadrao(raiz)`: `Capacitor.isNativePlatform()` e `Capacitor.Plugins.TextToSpeech` → nativo (`speak({text, lang:'pt-BR', rate, queueStrategy:0})`, `stop()`); senão `speechSynthesis` → navegador; senão nenhum. `temVoz` = motor ≠ nenhum. `voz.pausadaPeloLeitor` (getter), `voz.definirLeitorCelular(bool)`: verdadeiro cancela a fala e faz `podeFalar()` falso.
- Produces: `NaviLeitorCelular.criar({ plugin? }) → { ligado(): Promise<boolean>, aoMudar(cb: (ligado:boolean) => void) }`; sem plugin (navegador) `ligado()` → `false`.

- [ ] **Step 1: testes** (`voz.spec.js`, Node com `vm`, `prefs` falso):
  - motor nativo falso: `falar('Oi')` → `speak` com `{ text: 'Oi', lang: 'pt-BR', rate: 1, queueStrategy: 0 }`; velocidade 'devagar' → `rate: 0.8`; 'rapido' → 1.25.
  - `cancelar()` → `stop()`; `pausar()` no nativo → `stop()` e `pausada` verdadeiro; `continuar()` → fala de novo a última frase.
  - `motorPadrao`: com `Capacitor` nativo e `TextToSpeech` → 'nativo'; só `speechSynthesis` → 'navegador'; nada → 'nenhum'.
  - `definirLeitorCelular(true)` → `falar` devolve false e nada chega ao motor; `anunciar` ainda escreve na região; `false` → volta a falar.
  - `NaviLeitorCelular`: plugin falso `isEnabled → {value:true}` → `ligado()` true; evento `stateChange {value:false}` chama `aoMudar(false)`; sem plugin → false.
- [ ] **Step 2:** `PORTA=4391 npx playwright test --project=dados testes/dados/voz.spec.js` — Expected: FAIL.
- [ ] **Step 3:** Implementar (o motor navegador mantém o comportamento atual de `speechSynthesis`, inclusive escolha da voz pt-BR e pausa real).
- [ ] **Step 4:** Mesmo comando — Expected: PASS; `--project=dados` inteiro passa.
- [ ] **Step 5:** Commit `feat(voz): voz do Android no app e pausa com o TalkBack do celular`.

### Task 3: Gestos do TalkBack (`leitor-gestos.js`)

**Files:** Create `site-acessivel/js/leitor-gestos.js`; Modify `site-acessivel/css/base.css` (`.foco-gestos`); Test `testes/comportamento/voz-gestos.spec.js` (página de teste: `index.html` com a Voz ligada e `NaviGestos` ligado à mão via `page.evaluate` nesta tarefa).

**Interfaces:**
- Produces: `NaviGestos.criar({ voz, documento?, descreverExtra?: (el) => string|null, sons?: boolean }) → { ligar(), desligar(), ligado(), selecionar(el), proximo(), anterior(), ativar(), atual() }`; `NaviGestos.descrever(el, descreverExtra?) → string`; `NaviGestos.itensDeLeitura(raiz?) → Element[]`.
- Captura no `document` (`touchstart`/`touchmove`/`touchend` não passivos e `pointerdown`/`pointermove`/`pointerup` de toque): com 1 dedo, `preventDefault` + `stopPropagation`; com 2 ou mais, deixa passar e, ao chegar o segundo dedo, reenvia um `pointerdown` sintético do primeiro dedo ao elemento sob ele (marcado para não ser interceptado).
- Ativar: campos (`input`, `textarea`, `select`) → `focus()` e `click()`; itens com ponto de toque guardado dentro de `svg` → `MouseEvent('click', {clientX, clientY, bubbles:true})` no ponto; demais → `click()`. Som de ativação.

- [ ] **Step 1: testes** (`test.use({ hasTouch: true })`, voz falsa que guarda o que foi falado em `window.__falas`):
  - 1 toque no botão de Preferências → fala "Preferências, botão" e o diálogo **não** abre; retângulo visível em volta dele; 2 toques → diálogo abre.
  - deslizar para a direita duas vezes a partir do primeiro item → fala o 2º e o 3º itens de `itensDeLeitura()`; para a esquerda → volta; no último item, deslizar para a direita mantém o item.
  - com o diálogo aberto, deslizar só passa por itens dentro dele.
  - `descrever`: `<button aria-pressed="true">Voz</button>` → "Voz, botão de alternância, ativado"; `<input id=x value="Sala">` com label "Destino" → "Destino, campo de edição, Sala"; `[role=tab][aria-selected=true]` "Pendentes" → "Pendentes, aba, selecionado"; `<h2>Passo a passo</h2>` → "Passo a passo, título nível 2"; `<button disabled>Mapa 3D</button>` → "Mapa 3D, botão, indisponível"; `<a href>Área ADM</a>` → "Área ADM, link"; `<img alt="Logo">` → "Logo, imagem"; `aria-expanded=false` → "…, recolhido".
  - Review Focus 1: 2 toques num campo de busca → o campo fica focado e `page.keyboard.type('reuni')` muda o valor.
  - Review Focus 2: selecionar um item, removê-lo do DOM, deslizar para a direita → fala o primeiro item, sem erro.
  - Review Focus 5: com `NaviGestos` desligado, 1 toque em Preferências abre o diálogo.
- [ ] **Step 2:** `PORTA=4391 npx playwright test --project=celular testes/comportamento/voz-gestos.spec.js` — Expected: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando — Expected: PASS.
- [ ] **Step 5:** Commit `feat(voz): gestos do TalkBack (leitor-gestos.js)`.

### Task 4: Ligar nas páginas, mapa, tutorial e TalkBack do celular

**Files:** Modify `site-acessivel/js/pagina-rota.js`, `pagina-mapa.js`, `ui.js`, `index.html`, `mapa.html`, `beacons.html`, `adm.html` (scripts `leitor-celular.js`, `leitor-gestos.js` com `defer`), `sw.js` (PRECACHE, VERSAO); Test `testes/comportamento/voz-gestos.spec.js` (novo `describe`).

**Interfaces:**
- Consumes: Tasks 2 e 3.
- Regra de ligar: gestos ligados quando `prefs().voz && !prefs().leitorDeTela && !leitorCelularLigado && tela de toque (matchMedia('(pointer: coarse)') ou 'ontouchstart' in window)`; reavaliada ao mudar Preferências e no `aoMudar` do leitor do celular.
- Tutorial: depois do **Sim** da primeira visita e no botão "Ouvir como usar os gestos" (Preferências, seção da voz, visível só com a Voz ligada).
- `ui.js`: a leitura do foco por Tab passa a usar `NaviGestos.descrever`.
- Mapa: `descreverExtra` reconhece `svg.mapa-svg [data-id]` → "<nome>, <descrição do andar>".
- Avisos de beacon voltam a falar (tirar `falar: false` em `pagina-rota.js` e `pagina-mapa.js`).

- [ ] **Step 1: testes:**
  - primeira visita com toque: **Sim** → `__falas` termina com o tutorial; 1 toque num perfil não o escolhe e fala "Deficiência visual, …, botão".
  - Preferências: desligar a Voz → gestos desligados (1 toque volta a ativar) e retângulo some; "Ouvir como usar os gestos" fala o tutorial.
  - mapa com a Voz ligada: 1 toque num lugar da planta fala "Loja A, 1º andar" (ou o nome do lugar sob o toque); 2 toques abrem o cartão do lugar.
  - Review Focus 3: 2 dedos arrastando no mapa mudam o `viewBox` do SVG.
  - Review Focus 4: `Capacitor.Plugins.ScreenReader` falso ligado → nada em `__falas`, 1 toque ativa normalmente, região `#anuncio` recebe "O TalkBack do celular está ligado. O Navi deixa a leitura com ele."; evento de desligar → gestos voltam.
  - app com `TextToSpeech` falso: a pergunta da primeira visita é falada por `speak` (e não por `speechSynthesis`).
  - computador (sem toque): Voz ligada + Tab fala no formato "nome, tipo".
- [ ] **Step 2:** `PORTA=4391 npx playwright test --project=celular --project=computador testes/comportamento/voz-gestos.spec.js` — Expected: FAIL nos novos.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando e depois a suíte inteira — Expected: tudo passa.
- [ ] **Step 5:** Commit `feat(voz): gestos e voz do Android nas páginas, tutorial e TalkBack do celular`.

### Task 5: Plugins no app e APK

**Files:** Modify `app-android/package.json`; Test `testes/dados/app-android.spec.js`.

- [ ] **Step 1: teste:** `package.json` pede `@capacitor-community/text-to-speech` e `@capacitor/screen-reader` em `^8`.
- [ ] **Step 2:** Rodar — Expected: FAIL. **Step 3:** acrescentar. **Step 4:** PASS.
- [ ] **Step 5:** Commit, push; acompanhar o workflow até verde; baixar da branch `apk-teste`; conferir `assets/capacitor.plugins.json` com `TextToSpeech` e `ScreenReader` e o manifesto com `TTS_SERVICE`.

### Task 6: Roteiro e entrega

**Files:** Create `docs/kaizen/voz-gestos-roteiro.md`; Modify `site-acessivel/LEIA-ME.txt`.

- [ ] **Step 1:** Roteiro (instalar, ligar pelo **Sim**, gestos, mapa, TalkBack do celular ligado/desligado, comparação com o TalkBack, ficha de retorno, limitações da spec).
- [ ] **Step 2:** Suíte completa — Expected: tudo passa.
- [ ] **Step 3:** Commit, push, APK verde, enviar o APK na conversa.
