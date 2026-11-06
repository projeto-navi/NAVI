# Voz com gestos do TalkBack e voz do Android no app — especificação

Data: 05/11/2026. Branch: `app/android`. Situação: design aprovado na conversa (partes 1 e 2), aguardando revisão desta especificação.

## Objetivo

1. **Consertar o som no APK.** No app, "ouvir as instruções" não sai áudio: o navegador interno do Android (WebView) não tem a voz do navegador (`speechSynthesis`). O app passa a falar com a voz do Android.
2. **Deixar a Voz do Navi o mais parecida possível com o TalkBack**: com a Voz ligada, em tela de toque, a navegação usa os gestos do TalkBack e lê cada item com nome, tipo e estado.

Sucesso: no APK, ao tocar em **Sim** em "Deseja ouvir as instruções em voz alta?", o Navi fala o tutorial e passa a funcionar com 1 toque para ouvir, 2 toques para ativar e deslizar para mudar de item; as instruções da rota são faladas. Com o TalkBack do celular ligado, o Navi não fala nem intercepta toques.

## O que foi decidido

| Decisão | Escolha |
|---|---|
| Estilo | Gestos iguais aos do TalkBack (não só ler o que é tocado) |
| Como liga | Junto com a Voz: o **Sim** da pergunta da primeira visita (ou a Voz nas Preferências) liga voz e gestos |
| Voz no app | Voz do Android, plugin `@capacitor-community/text-to-speech` 8 (`TextToSpeech`) |
| TalkBack de verdade | No app, plugin oficial `@capacitor/screen-reader` 8 (`ScreenReader.isEnabled`, evento `stateChange`): ligado → voz e gestos do Navi param |
| Computador | Sem gestos; com a Voz ligada, lê o item que recebe o foco (Tab) no mesmo formato |

## Restrições que continuam valendo

- Site sem build, abre por `file://` e offline; funciona no navegador como antes quando a Voz está desligada.
- Motor de rotas não muda.
- Regras novas entram no Documento 04 antes do código, como propostas (RN76–RN78), aguardando Camilly e Leonardo.
- A opção "Uso leitor de tela" continua silenciando o Navi (no navegador, é o único jeito de saber).

## Comportamento

### Gestos (Voz ligada, tela de toque, TalkBack do celular desligado)

| Gesto | Efeito |
|---|---|
| 1 toque | Seleciona o item sob o dedo e lê; não ativa |
| 2 toques rápidos (≤ 300 ms entre eles), em qualquer lugar | Ativa o item selecionado (o mesmo que um clique) |
| Arrastar 1 dedo | Explora: lê cada item novo que passa sob o dedo |
| Deslizar 1 dedo para a direita / esquerda (rápido, ≥ 60 px, mais horizontal que vertical) | Próximo / item anterior, na ordem da página |
| 2 dedos | Passam direto: rolam a página; no mapa, arrastam e a pinça dá zoom; no 3D, giram a câmera |

- O teclado na tela não é afetado (os gestos valem só para a página).
- **Ordem de leitura:** botões, links, campos, abas, títulos, textos (parágrafos e itens de lista com texto), imagens com descrição, na ordem do documento; só o que está visível e não está escondido de leitores de tela (`aria-hidden`, `hidden`, `inert`). Com uma janela aberta (`<dialog open>` ou `role="dialog"` modal), só o que está dentro dela.
- Ao chegar ao fim ou ao início da página, um som diferente e nada muda.
- Se o item selecionado sai da tela (a página mudou), o próximo deslize recomeça do primeiro item.

### O que é lido (`descrever`)

Formato: **nome, tipo, estado** — só as partes que existem, separadas por vírgula.

- **Nome:** `aria-labelledby` → `aria-label` → `<label>` do campo → texto visível → `alt` / `title`. Campos com valor: nome + valor ("Destino, campo de edição, Sala de reunião").
- **Tipo:** botão; link; campo de edição; caixa de seleção; botão de opção; botão de alternância (`aria-pressed`); aba; título nível N; imagem; lista suspensa; controle deslizante. Texto comum não tem tipo.
- **Estado:** ativado / desativado (alternância e caixas de seleção marcadas ou não); selecionado (abas, opções); expandido / recolhido; indisponível (`disabled` ou `aria-disabled`).
- **Mapa:** um lugar da planta (`[data-id]` no SVG) é lido como "<nome do lugar>, <andar>"; 2 toques fazem o mesmo que o clique de hoje (abrem as informações do lugar).

### Retorno visual e sonoro

- Retângulo verde (#4CAF50 em contorno de 3 px, cantos arredondados) em volta do item selecionado, por cima de tudo, sem interceptar toques. Some quando a Voz desliga.
- Sons curtos (Web Audio, ~60 ms, volume baixo): um ao mudar de item, outro ao ativar, outro no fim da lista. Sem Web Audio, sem som.

### Primeira visita e Preferências

- **Sim** em "Deseja ouvir as instruções em voz alta?" → Voz ligada → fala: *"Voz ligada. Toque uma vez para ouvir um item, toque duas vezes para ativar e deslize para a direita para ir ao próximo."* e os gestos já valem.
- Preferências: botão **"Ouvir como usar os gestos"** (fala o tutorial de novo).
- Desligar a Voz desliga os gestos na hora.

### Voz no app (Android)

- Motor de voz escolhido assim: plugin nativo `TextToSpeech` (dentro do app) → `speechSynthesis` (navegador) → nenhum.
- No app: `TextToSpeech.speak({ text, lang: 'pt-BR', rate, queueStrategy: 0 })` (0 = interrompe a fala anterior); `stop()` para cancelar. A velocidade das Preferências (devagar, normal, rápida) vira `rate` 0,8 / 1,0 / 1,25.
- "Pausar" no app para a fala; "Continuar" fala de novo a frase atual desde o começo (a voz do Android não pausa no meio).
- Os avisos de beacon ("Você está perto de X", "Você chegou: X") voltam a ser falados quando a Voz está ligada.

### TalkBack do celular (só no app)

- Ao abrir e quando o estado muda (`stateChange`): TalkBack ligado → o Navi para de falar, desliga os gestos e anuncia uma vez (só pela região `aria-live`, para o próprio TalkBack ler): *"O TalkBack do celular está ligado. O Navi deixa a leitura com ele."* TalkBack desligado → se a Voz estiver ligada, voz e gestos voltam.
- A preferência "Voz" não é alterada por isso (é só uma pausa enquanto o TalkBack estiver ligado).

## Arquitetura

```
site-acessivel/js/voz.js          motor de voz: nativo (TextToSpeech) → navegador → nenhum; mesma interface de hoje
site-acessivel/js/leitor-gestos.js NaviGestos: gestos, ordem de leitura, descrever, retângulo e sons
site-acessivel/js/leitor-celular.js NaviLeitorCelular: TalkBack do celular ligado? (ScreenReader no app; falso no navegador)
site-acessivel/js/pagina-rota.js  tutorial depois do "Sim"; liga NaviGestos
site-acessivel/js/pagina-mapa.js  liga NaviGestos; avisos de beacon voltam a falar
site-acessivel/js/ui.js           botão "Ouvir como usar os gestos" nas Preferências
site-acessivel/css/base.css       retângulo verde (.foco-gestos)
app-android/package.json          + @capacitor-community/text-to-speech ^8, @capacitor/screen-reader ^8
```

Interfaces:

- `NaviVoz.criar({ regiao, avisoEl, prefs, motor? })` continua com `falar`, `anunciar`, `pausar`, `continuar`, `repetir`, `cancelar`, `temVoz` e ouvintes; ganha `motor` (`'nativo' | 'navegador' | 'nenhum'`). `motor` injetável para testes.
- `NaviGestos.criar({ voz, documento?, sons? }) → { ligar(), desligar(), ligado(), selecionar(el), proximo(), anterior(), ativar(), atual() }` e `NaviGestos.descrever(el, contexto?) → string`, `NaviGestos.itensDeLeitura(raiz) → Element[]`.
- `NaviLeitorCelular.criar({ plugin? }) → { ligado(): Promise<boolean>, aoMudar(cb) }`.

Os gestos usam eventos de toque na fase de captura no `document`: com 1 dedo, o evento é consumido (`preventDefault` + `stopPropagation`) e vira leitura/ativação; com 2 ou mais dedos, os eventos seguem normalmente para a página, o mapa 2D e o 3D. A ativação dispara `click()` no item selecionado (e `focus()` nos campos, abrindo o teclado).

## Regras propostas para o Documento 04 (v1.7)

- **RN76** — Com a Voz ligada, em tela de toque, o Navi usa os gestos do TalkBack: 1 toque lê, 2 toques ativam, deslizar para a direita ou a esquerda muda de item; cada item é lido com nome, tipo e estado.
- **RN77** — Se o TalkBack (ou outro leitor de tela) do celular estiver ligado, a voz e os gestos do Navi param e a leitura fica com ele.
- **RN78** — No app, as instruções são faladas pela voz do Android, em português do Brasil, na velocidade das Preferências.

## Testes

- **Comportamento (Playwright, toque simulado, `hasTouch`):** `testes/comportamento/voz-gestos.spec.js`
  - 1 toque num botão lê "Próximo, botão" e não ativa; 2 toques ativam.
  - Deslizar para a direita / esquerda percorre os itens na ordem; no fim, som de fim e nada muda.
  - Janela aberta prende a ordem dentro dela.
  - `descrever`: botão de alternância ativado/desativado, campo com valor, aba selecionada, título nível 2, indisponível, link, imagem.
  - Mapa: 1 toque num lugar lê "<nome>, <andar>"; 2 toques abrem as informações do lugar; 2 dedos continuam movendo o mapa.
  - "Sim" da primeira visita fala o tutorial e liga os gestos; desligar a Voz desliga os gestos e some o retângulo.
  - Voz desligada: toques funcionam como hoje (regressão).
  - Computador: com a Voz ligada, Tab lê o item focado.
- **Voz (dados/comportamento):** motor nativo falso recebe `speak` com `lang: 'pt-BR'` e a velocidade certa; sem plugin, cai para `speechSynthesis`; "Pausar"/"Continuar" no motor nativo.
- **TalkBack do celular falso:** ligado → nada é falado, gestos desligados, anúncio na região `aria-live`; desligado → volta.
- **APK:** `app-android.spec.js` confere as duas dependências novas; o workflow continua verde.
- **Celular:** roteiro em `docs/kaizen/voz-gestos-roteiro.md`, de preferência com alguém que use TalkBack.

## Limitações

- Os gestos valem só dentro do Navi; não substituem o TalkBack para o celular.
- Fora: menu de controles de leitura do TalkBack, gesto em "L" para voltar (no Navi, botão Voltar), leitura de notificações, gestos de 3 dedos.
- No navegador não dá para saber se o TalkBack está ligado: vale a opção "Uso leitor de tela".
- Com a Voz ligada, tudo pede 2 toques; quem não precisa deve desligar a Voz (Preferências é o primeiro item do "próximo").
- No app, "Pausar" não retoma do meio da frase.
- A qualidade da voz depende do motor de voz instalado no celular (Google, Samsung); se faltar o português, o Android usa o padrão dele.

## Fora desta versão

Gestos no iPhone/VoiceOver, ditado por voz, vibração a cada item, personalizar gestos.
