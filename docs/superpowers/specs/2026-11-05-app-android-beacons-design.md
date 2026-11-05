# App Android do Navi com beacons — especificação

Data: 05/11/2026. Branch: `app/android` (saindo de `adm/avisos`, para o app já ter a Área ADM e os avisos compartilhados).
Situação: design aprovado na conversa (partes 1 e 2), aguardando revisão desta especificação.

## Objetivo

Um APK de teste para Android que abre o Navi e percebe os beacons Bluetooth do prédio. Quando a pessoa chega perto de um beacon cadastrado, o app diz "Você está perto de X" e oferece usar esse lugar como ponto de partida.

Sucesso: o APK instala num celular Android, abre o Navi, pede Bluetooth, localização e permissão com explicação clara, mostra os beacons por perto na tela de teste e mostra "Você está perto de X" ao chegar perto de um beacon simulado.

## O que foi decidido

| Decisão | Escolha |
|---|---|
| Abordagem | Capacitor 8 + `@capacitor-community/bluetooth-le` 8 (caminho A) |
| Onde fica o site | Dentro do app (cópia de `site-acessivel/` a cada build). Funciona sem internet, como o site |
| O que os beacons fazem nesta versão | Tela de teste + "Você está perto de X" (proximidade, não posição em tempo real) |
| Beacons para teste | Ainda não há beacons; testes com um segundo celular no app Beacon Simulator. O app já vem pronto para os FSC-BP108B (padrão iBeacon) |
| Plataforma | Só Android |
| Como o APK é gerado | GitHub Actions (este ambiente não tem as ferramentas do Android e não alcança o npm nem o Maven) |
| Assinatura | Chave de teste fixa no repositório, para cada APK novo instalar por cima do anterior. Só para testes, nunca para a Play Store |

## Restrições que continuam valendo

- O site continua HTML/CSS/JS puro, sem build, abrindo por `file://` e offline. No navegador, nada muda: o código novo só liga dentro do app.
- O motor de rotas não muda.
- Toda regra nova passa pelo Documento 04 antes do código, como proposta, aguardando Camilly e Leonardo.
- Nenhum dado pessoal sai do aparelho (RN55, RN07). A detecção de beacons acontece só no celular; nada é enviado.

## Arquitetura

```
app-android/                      projeto Capacitor (sem a pasta android/, que o CI gera)
  package.json                    @capacitor/core, cli, android 8; @capacitor-community/bluetooth-le 8
  capacitor.config.json           appId br.com.projetonavi.navi, appName "Navi", webDir "www"
  scripts/copiar-site.mjs         copia ../site-acessivel para www/
  scripts/ajustar-android.mjs     depois de "cap add android": permissões, nome, ícone, chave de teste
  chave-teste/navi-teste.jks      chave de teste fixa (senha pública, documentada)
  LEIA-ME.md                      como gerar, baixar, instalar e testar
.github/workflows/apk.yml         gera o APK e publica o artefato navi-teste

site-acessivel/
  js/beacons.js                   lógica pura: ler iBeacon, distância, perto/longe (testável no Node)
  js/beacons-app.js               ligação com o celular: permissões, Bluetooth, localização, busca
  js/beacons-ui.js                painel "Encontrar onde você está", cartão/faixa "Perto de você"
  beacons.html                    tela de teste "Beacons por perto"
  locais/predio-teste/beacons.js  lista beacon → lugar
```

O site não tem build, então não importa o módulo JavaScript do plugin: usa a ponte nativa do Capacitor, `window.Capacitor.Plugins.BluetoothLe`, que já existe dentro do app. `beacons-app.js` isola essa ponte; o resto do site só conversa com `beacons-app.js`. Fora do app (`window.Capacitor` ausente ou `isNativePlatform()` falso), `beacons-app.js` informa "indisponível" e nenhuma parte nova aparece.

### Permissões do Android

- `BLUETOOTH_SCAN` **sem** a marca `neverForLocation` (com ela, o Android esconde beacons da busca), `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION`.
- `BleClient.initialize({ androidNeverForLocation: false })`.
- A localização do aparelho precisa estar ligada para a busca encontrar beacons (regra do Android). O GPS em si não é usado.

### Geração do APK (`apk.yml`)

Roda em todo push na branch `app/android` que mexer em `app-android/**`, `site-acessivel/**` ou no próprio workflow, e sob demanda (Actions → "APK de teste" → Run workflow). Passos: Node 22 e Java 21; `npm install` em `app-android/`; `copiar-site`; `npx cap add android`; `ajustar-android`; `npx cap sync android`; `./gradlew assembleDebug` assinado com a chave de teste; publica `navi-teste.apk` como artefato (guardado 30 dias). Em seguida, o arquivo pode ser baixado e enviado na conversa.

## Comportamento

### Lista de beacons (`locais/predio-teste/beacons.js`)

```js
naviLocal("predio-teste").beacons = {
  uuid: "FDA50693-A4E2-4FB1-AFCF-C6EB07647825", // padrão de fábrica Feasycom
  raioPadrao: 2,                                 // metros
  lista: [
    { major: 1, minor: 1, lugar: "PCT_P01_L0001" }, // Entrada principal
    { major: 1, minor: 2, lugar: "PCT_P01_L0007" }, // Elevador 1, 1º andar
    { major: 1, minor: 3, lugar: "PCT_P01_L0002" }, // Recepção
    { major: 1, minor: 4, lugar: "PCT_P01_L0010" }, // Escada B, 1º andar
    { major: 1, minor: 5, lugar: "PCT_P01_L0011" }, // Rampa, 1º andar
    { major: 1, minor: 6, lugar: "PCT_P02_L0008" }, // Elevador 1, 2º andar
    { major: 1, minor: 7, lugar: "PCT_P02_L0007" }, // Sala de reunião
    { major: 1, minor: 8, lugar: "PCT_P03_L0001" }  // Sala de eventos
  ]
};
```

Cada item pode ter `raio` próprio. Um lugar inexistente na lista é recusado pelo validador de dados do local. Os números são de teste até a instalação dos beacons reais.

### Leitura e decisão (`js/beacons.js`, puro)

- **iBeacon:** dados de fabricante da Apple (empresa 0x004C) começando com `02 15`, seguidos de UUID (16 bytes), major (2), minor (2) e potência medida a 1 m (1 byte com sinal). Aceita os dados como texto hexadecimal (ponte nativa) ou `DataView`. Qualquer outra coisa é ignorada.
- **Distância:** `d = 10 ^ ((potencia1m − rssi) / (10 × 2,5))`, com o RSSI suavizado (média móvel exponencial, peso 0,3 para a leitura nova). Sem potência no pacote, usa −59 dBm.
- **Perto:** entra quando a distância suavizada fica ≤ raio em 2 leituras seguidas; sai quando passa de 2 × raio ou após 8 s sem leitura. Com vários beacons perto, vale o de menor distância. Só beacons da lista viram "perto".
- Interface: `NaviBeacons.lerIBeacon(dados) → {uuid, major, minor, potencia} | null`, `NaviBeacons.distancia(rssi, potencia) → metros`, `NaviBeacons.criarRastreador({lista, uuid, raioPadrao, agora}) → { registrar(leitura), atual() → {lugar, distancia} | null, todos() → [...] }`.

### Ligação com o celular (`js/beacons-app.js`)

- `situacao() → { disponivel, bluetooth, localizacao, permissao }`, e métodos `permitir()`, `ligarBluetooth()`, `ligarLocalizacao()`, `comecar(aoLer)`, `parar()`.
- Busca com `allowDuplicates: true` e `SCAN_MODE_LOW_LATENCY` enquanto a página está visível; para quando a página fica oculta e volta ao reaparecer.
- A escolha "procurar" fica guardada no aparelho (`navi-beacons`). "Parar de procurar" apaga.

### Telas

1. **Painel "Encontrar onde você está"** (cartão na Página de Rota, só no app). Frase de abertura: *"O Navi usa o Bluetooth e a localização do celular só para perceber os beacons do prédio. Nada sai do seu celular."* Três linhas: Bluetooth ("Ligado" / "Ligar o Bluetooth"), Localização ("Ligada" / "Ligar a localização"), Permissão ("Permitida" / "Permitir"). "Começar a procurar" só fica ativo com as três em ordem. Com a busca ligada: "Parar de procurar".
2. **"Perto de você"**: na Página de Rota, cartão "Você está perto de: Elevador 1 (1º andar)" com **"Sair daqui"** (preenche a partida). Na Página do Mapa, faixa com o mesmo texto e **"Recalcular daqui"**. O leitor de tela anuncia uma vez por chegada. A rota só muda se a pessoa tocar.
3. **"Beacons por perto"** (`beacons.html`, link em Preferências, só no app): lista de todos os iBeacons percebidos, com UUID, major, minor, sinal (dBm), distância aproximada, lugar ou "não cadastrado" e há quanto tempo foi visto. Botão **"Copiar números"**.

### Quando algo falha

- Bluetooth ou localização desligados durante a busca: a busca pausa, aparece um aviso com o botão para religar.
- Permissão negada: o painel explica o que deixa de funcionar e como permitir em Configurações → Apps → Navi → Permissões.
- Página em segundo plano: a busca para; volta ao retornar.
- Beacon fora da lista: só aparece na tela de teste.
- Fora do app: nenhuma parte nova aparece.

## Regras propostas para o Documento 04 (v1.5, aguardando aprovação)

- **RN71** — O app Android é opcional e abre o mesmo Navi do site, com o site guardado dentro dele.
- **RN72** — A localização por beacons só liga quando a pessoa pede, com explicação antes, e desliga a qualquer momento.
- **RN73** — A detecção de beacons acontece só no celular; nada sobre onde a pessoa está é enviado ou guardado fora do aparelho.
- **RN74** — "Você está perto de X" só sugere o ponto de partida ou o recálculo; a rota nunca muda sem a pessoa tocar.
- Nota: a seção "Fora do escopo" deixa de listar "Localização automática (beacons)" e "Aplicativo nativo para celular" para a fase de testes, com a ressalva de que a posição em tempo real continua fora.

## Testes

- **Dados (Node):** `testes/dados/beacons.spec.js` — pacotes iBeacon gravados (hex e DataView), pacote de outra empresa, pacote curto, potência negativa; distância; entrada após 2 leituras, saída por distância e por tempo, escolha do mais próximo, beacon fora da lista; validação de `beacons.js` do local.
- **Comportamento (Playwright):** `testes/comportamento/beacons-app.spec.js` com um plugin falso (`testes/apoio/bluetooth-falso.js`) injetado como `window.Capacitor.Plugins.BluetoothLe`: painel e suas três linhas, "Começar a procurar", cartão "Perto de você" e "Sair daqui", faixa no mapa e "Recalcular daqui", tela de teste, Bluetooth desligado no meio, permissão negada, página oculta. No navegador comum: nada novo aparece. Alvos de 48 px e nomes acessíveis a 360 px.
- **APK:** o workflow precisa terminar verde. O teste no celular segue o roteiro abaixo.

## Roteiro de teste no celular

**O que é preciso:** um celular Android (8 ou mais novo, de preferência) para o Navi; um segundo celular Android com o app gratuito **Beacon Simulator**; acesso ao repositório no GitHub (ou o APK enviado na conversa).

1. **Baixar:** GitHub → Actions → "APK de teste" → execução mais recente com ✓ → Artifacts → navi-teste (o APK está dentro do `.zip`). Passar para o celular por cabo, Drive ou WhatsApp.
2. **Instalar:** permitir "instalar apps desconhecidos" para o app que abriu o arquivo; no aviso do Play Protect, "Mais detalhes" → "Instalar mesmo assim". As próximas versões instalam por cima.
3. **Beacon simulado:** no segundo celular, criar um iBeacon com UUID `FDA50693-A4E2-4FB1-AFCF-C6EB07647825`, major 1 e o minor do lugar (tabela acima; minor 2 = Elevador 1) e ligar a transmissão. Para testar troca, criar dois com minors diferentes.
4. **Roteiro:**
   1. Permissões: "Encontrar onde você está" → ligar Bluetooth, localização e permissão; cada linha muda para "em ordem".
   2. Tela de teste: Preferências → "Beacons por perto"; o beacon aparece; anotar o sinal a 1 m e a 3 m.
   3. Perto: celulares a ~1 m; em alguns segundos, "Você está perto de: Elevador 1".
   4. Longe: afastar ~5 m ou desligar o simulador; a mensagem some em até ~8 s.
   5. Partida: "Sair daqui" e escolher um destino; a rota começa no Elevador 1.
   6. Mapa: com rota aberta, chegar perto de outro beacon; faixa e anúncio; "Recalcular daqui" refaz a rota.
   7. Erros: desligar o Bluetooth com a busca ligada; negar a permissão; mandar o app para segundo plano e voltar.
   8. Acessibilidade: repetir 1, 3 e 5 com o TalkBack.
   9. Resto do Navi: rotas, 3D, avisos e Área ADM (estes dois precisam de internet).
   10. Anotar cada passo na ficha de retorno (celular, versão do Android, o que aconteceu).

## Limitações desta versão

- Só Android. iPhone precisa de Mac (ou serviço pago) e da conta de desenvolvedor da Apple (US$ 99/ano).
- APK de teste: aviso do Play Protect, download só para membros do repositório, publicação na Play Store exige outra chave e conta (US$ 25).
- A distância é estimativa, com erro de ~1 a 3 m; muda com celular, paredes, pessoas e a mão. Beacons reais precisam de calibração (sinal a 1 m).
- Simulador não é beacon real: as distâncias do teste não serão as reais.
- Diz "perto de qual beacon", não "onde no mapa"; o ponto não anda (posição em tempo real fica para depois).
- Só com o app aberto e a tela ligada.
- A localização precisa estar ligada, mesmo sem GPS (regra do Android).
- Algumas marcas (Xiaomi, Samsung em economia de bateria) atrasam a busca.
- O site fica dentro do app: mudanças no site só chegam com APK novo (avisos e Área ADM vêm do Supabase).
- Os números dos beacons são de teste até a instalação real.
- As regras RN71–RN74 ainda são propostas.

## Fora desta versão

Posição em tempo real, busca em segundo plano, iPhone, Play Store, notificações do app, calibração automática, envio de qualquer dado de localização.

## Riscos

- **Build só no CI:** a primeira execução pode falhar por detalhes de versão (SDK, Gradle). Mitigação: acompanhar as execuções com a CLI do GitHub e corrigir até ficar verde.
- **Ponte nativa sem o módulo JS do plugin:** o formato dos eventos da ponte (`onScanResult`, dados em hex) pode diferir do esperado. Mitigação: `beacons-app.js` isola a ponte e `beacons.js` aceita hex e `DataView`; a tela de teste mostra o que chega.
- **Chave de teste pública:** qualquer pessoa com o repositório pode assinar um APK "Navi" de teste. Aceitável para teste; para a loja será outra chave, fora do repositório.
