# Roteiro de testes — app Android do Navi com beacons

Versão de 05/11/2026 (revisada depois do primeiro teste no celular). Branch `app/android`. Regras em teste: RN71 a RN75 (propostas no Documento 04 v1.6, aguardando aprovação de Camilly e Leonardo).

O app guarda o site do Navi e percebe beacons Bluetooth (padrão iBeacon). Ao traçar uma rota, a busca liga sozinha. Quando a pessoa chega perto de um beacon cadastrado, o mapa mostra uma **bolinha vermelha "Você está aqui"** no lugar do beacon e a faixa "Você está perto de X", com a opção de recalcular a rota dali. A bolinha fica no lugar do beacon: ela não acompanha cada passo.

## O que é preciso

- 1 celular Android para o Navi (Android 8 ou mais novo, de preferência).
- 1 segundo celular Android com o app gratuito **Locate Beacon** (Play Store), fazendo papel de beacon. No primeiro teste, o Redmi Note 14 Pro 4G transmitiu bem. Alternativa: **nRF Connect for Mobile** (Nordic), aba Advertiser.
- O APK `navi-teste.apk`. Onde baixar:
  - no GitHub, trocando a branch para **`apk-teste`**, abrindo `navi-teste.apk` e clicando em **Download raw file** (é sempre o mais recente);
  - ou em **Actions → APK de teste → execução com ✓ → Artifacts → navi-teste** (vem num `.zip`).

## Instalar

1. Passe o APK para o celular (cabo, Drive ou WhatsApp) e abra.
2. Permita "instalar apps desconhecidos" para o app que abriu o arquivo.
3. No aviso do Play Protect: **Mais detalhes → Instalar mesmo assim**.
4. As próximas versões instalam por cima, sem desinstalar.

## Montar o beacon simulado (Locate Beacon)

1. No segundo celular, dê ao Locate a permissão **Dispositivos por perto** (Configurações → Apps → Locate → Permissões) e tire-o da economia de bateria.
2. Abra **Beacon Transmitter** e preencha: **ID1** `FDA50693-A4E2-4FB1-AFCF-C6EB07647825`, **ID2** `1`, **ID3** = minor do lugar (tabela), **Power** `-59`, **Beacon format** **iBeacon**.
3. Toque na **chavinha** para transmitir (o **Apply** só funciona com ela ligada, para trocar valores). Deixe a tela acesa.
4. O Locate não guarda os campos: ao reabrir, preencha de novo.

| minor | Lugar |
|---|---|
| 1 | Entrada principal |
| 2 | Elevador 1 (1º andar) |
| 3 | Recepção |
| 4 | Escada B (1º andar) |
| 5 | Rampa (1º andar) |
| 6 | Elevador 1 (2º andar) |
| 7 | Sala de reunião |
| 8 | Sala de eventos |

## Cenários

| # | O que fazer | Esperado |
|---|---|---|
| 0 | **Preferências → Beacons por perto** | Mostra "Versão do app" (confira se é a do APK mais recente) e "Leituras recebidas" |
| 1 | Trace uma rota (Entrada → Sala de reunião) com Bluetooth e localização ligados | A busca liga sozinha; na primeira vez, o Android pede as permissões |
| 1b | Trace uma rota com o Bluetooth desligado | Faixa "Para mostrar onde você está no mapa, ative o Bluetooth e a localização." com **Ativar**; ao tocar, o Android liga o que falta e a busca começa |
| 2 | **Preferências → Beacons por perto**, com o simulador ligado (minor 2) | O beacon aparece com "Elevador 1", "minor 2", sinal e distância. Anote o sinal a 1 m e a 3 m |
| 3 | **Começar a procurar** e deixe os celulares a ~1 m | Em alguns segundos: "Você está perto de: Elevador 1 (1º andar)" |
| 4 | Afaste-se ~5 m ou desligue o simulador | A mensagem some em até ~8 s |
| 5 | Perto do Elevador 1, toque em **Sair daqui** e escolha um destino | A rota começa no Elevador 1 |
| 6 | Abra uma rota (Entrada → Sala de reunião) e chegue perto da Rampa (minor 5) | **Bolinha vermelha "Você está aqui"** na rampa (2D e 3D); a partida passa a se chamar "Partida: Entrada principal"; faixa "Você está perto de: Rampa (1º andar)"; **Recalcular daqui** refaz a rota saindo da rampa |
| 6b | Com o mapa no 1º andar, chegue perto do minor 6 (Elevador 1, 2º andar) | A bolinha só aparece ao mudar para o 2º andar; a faixa diz o andar |
| 6c | Deixe o app procurando com muitos aparelhos Bluetooth em volta (fones, relógios) | Nada trava; a tela continua respondendo |
| 7 | Com a mesma rota, chegue perto da Sala de reunião (minor 7) | "Você chegou: Sala de reunião", sem botão |
| 8 | Com a busca ligada, desligue o Bluetooth | "O Bluetooth foi desligado. A busca está pausada." com "Ligar o Bluetooth"; religando, volta a procurar |
| 9 | Negue a permissão quando o Android perguntar | O painel explica como permitir em Configurações → Apps → Navi → Permissões |
| 10 | Mande o app para segundo plano e volte | A busca para e volta sozinha |
| 11 | Repita 1, 3 e 5 com o **TalkBack** ligado | Tudo é lido; os anúncios de "perto de" chegam uma vez por chegada |
| 12 | Rotas, 3D, avisos e Área ADM | Funcionam como no site (avisos e Área ADM precisam de internet) |
| 13 | **Parar de procurar** (cartão da página inicial) | A busca desliga e não religa sozinha ao traçar rota, até a pessoa pedir de novo |

## Ficha de retorno

| Data | Quem testou | Celular e versão do Android | Cenário | Aconteceu o esperado? | O que estranhou ou faltou | Ideia de melhoria |
|---|---|---|---|---|---|---|
| | | | | | | |

## Limitações desta versão

- Só Android. iPhone precisa de Mac (ou serviço pago) e da conta de desenvolvedor da Apple (US$ 99/ano).
- APK de teste: o Play Protect avisa; publicar na Play Store exige outra chave e conta Google (US$ 25).
- A distância é estimativa, com erro de cerca de 1 a 3 m; muda com o celular, paredes, pessoas e a mão. Beacons reais precisam de calibração (sinal a 1 m).
- O simulador não é um beacon real: as distâncias do teste não serão as reais.
- Diz "perto de qual beacon", não "onde no mapa"; o ponto não anda.
- Só com o app aberto e a tela ligada.
- A localização do celular precisa estar ligada, mesmo sem GPS (regra do Android para procurar beacons).
- Algumas marcas (Xiaomi, Samsung em economia de bateria) atrasam a busca: tire o Navi da economia de bateria.
- O site fica dentro do app: mudanças no site só chegam com um APK novo (avisos e Área ADM vêm do Supabase).
- Os números dos beacons são de teste até a instalação real (`site-acessivel/locais/predio-teste/beacons.js`).

## Perguntas para esta rodada

- O raio de 2 m para "perto" é bom? Ele fica em `beacons.js` do local (`raioPadrao`, ou `raio` por beacon).
- A mensagem demora para aparecer ou para sumir?
- "Sair daqui" e "Recalcular daqui" são claros?
- A explicação sobre Bluetooth e localização convence quem tem receio de ser rastreado?
