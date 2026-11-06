# Roteiro de testes — voz com gestos do TalkBack e voz do Android no app

Versão de 06/11/2026. Branch `app/android`. Regras em teste: RN76 a RN78 (propostas no Documento 04 v1.7, aguardando aprovação de Camilly e Leonardo).

Com a Voz ligada, o Navi passa a funcionar como o TalkBack **dentro do site**: 1 toque lê, 2 toques ativam, deslizar muda de item. No app, a voz agora sai pela voz do Android (antes o app ficava mudo). Se o TalkBack do celular estiver ligado, o Navi não fala e deixa a leitura com ele.

## O que é preciso

- 1 celular Android com o APK novo (`navi-teste.apk` da branch **`apk-teste`**; instala por cima do anterior).
- Confira em **Preferências → Beacons por perto** se a "Versão do app" é a mais recente.
- Volume de mídia alto. Se o celular não tiver voz em português, instale em **Configurações → Gerenciamento geral → Idioma → Saída de texto para voz** (Samsung) ou **Sistema → Idiomas → Saída de conversão de texto em voz** (Xiaomi/Google) o "Mecanismo de conversão de texto em voz do Google" com o português do Brasil.
- De preferência, alguém que use o TalkBack no dia a dia, para comparar.

## Como os gestos funcionam

| Gesto | O que faz |
|---|---|
| 1 toque | Seleciona o item sob o dedo e lê (não ativa) |
| 2 toques rápidos, em qualquer lugar | Ativa o item selecionado |
| Arrastar 1 dedo devagar | Lê cada item que passa sob o dedo |
| Deslizar 1 dedo para a direita / esquerda (rápido) | Próximo / item anterior |
| 2 dedos | Rolam a página; no mapa, arrastam e a pinça dá zoom |

O item selecionado fica com um **retângulo verde**. Sons curtos: um ao mudar de item, outro ao ativar, outro no fim da lista.

## Cenários

| # | O que fazer | Esperado |
|---|---|---|
| 1 | Apague as preferências (**Preferências → Apagar minhas preferências**) ou instale do zero. Abra o app | A pergunta "Deseja ouvir as instruções em voz alta?" é **falada** pela voz do Android |
| 2 | Toque em **Sim** | Fala "Voz ligada. Toque uma vez para ouvir um item, toque duas vezes para ativar e deslize para a direita para ir ao próximo…" e depois a pergunta do perfil |
| 3 | Toque uma vez em **Deficiência visual** | Lê "Deficiência visual, botão, Letras maiores…"; retângulo verde; o perfil **não** é escolhido |
| 4 | Toque duas vezes (em qualquer lugar) | O perfil é escolhido e o Navi fala a próxima pergunta |
| 5 | Deslize para a direita várias vezes | Passa por cada item na ordem da tela; no último, um som de fim e nada muda. Para a esquerda, volta |
| 6 | Selecione o campo de busca e toque duas vezes | O teclado abre; digite "reuni" e escolha **Sala de reunião** com 1 toque + 2 toques |
| 7 | Trace a rota (Entrada → Sala de reunião) | O passo 1 é falado. **Próximo** com 1 toque + 2 toques fala o passo seguinte |
| 8 | No mapa, toque uma vez num lugar da planta | Lê "<nome do lugar>, <andar>"; 2 toques abrem o cartão do lugar |
| 9 | No mapa, arraste com **2 dedos** e faça pinça | A planta se move e dá zoom |
| 10 | **Pausar** e **Continuar** na barra de voz | Pausar cala; Continuar fala a frase de novo **desde o começo** |
| 11 | **Velocidade** (Devagar, Normal, Rápida) | A voz muda de velocidade na próxima frase |
| 12 | **Preferências → Ouvir como usar os gestos** | Fala o tutorial de novo |
| 13 | **Preferências → Ouvir as instruções em voz alta** → desligar (1 toque + 2 toques) | A voz para, o retângulo some e 1 toque volta a ativar direto |
| 14 | Ligue o **TalkBack do celular** (Configurações → Acessibilidade → TalkBack) e volte ao Navi | O TalkBack lê "O TalkBack do celular está ligado. O Navi deixa a leitura com ele."; a voz do Navi e o retângulo verde não aparecem; os gestos são os do TalkBack |
| 15 | Desligue o TalkBack e volte ao Navi | A voz e os gestos do Navi voltam (se a Voz estiver ligada) |
| 16 | Com beacon simulado (roteiro `app-beacons-roteiro.md`), chegue perto de um lugar com a Voz ligada | "Você está perto de: …" é falado |
| 17 | No computador (navegador), com a Voz ligada, use **Tab** | Cada item focado é lido como "nome, tipo" (ex.: "Pular para o conteúdo, link"); sem retângulo verde |

## Comparação com o TalkBack (para quem usa)

- O que ficou parecido? O que estranhou (tempo dos 2 toques, força do deslize, o que é lido)?
- A ordem dos itens faz sentido?
- Faltou algum gesto que você usa muito?

## Ficha de retorno

| Data | Quem testou | Celular e versão do Android | Cenário | Aconteceu o esperado? | O que estranhou ou faltou | Ideia de melhoria |
|---|---|---|---|---|---|---|
| | | | | | | |

## Limitações desta versão

- Os gestos valem só dentro do Navi; não substituem o TalkBack para o resto do celular.
- Fora: menu de controles de leitura do TalkBack, gesto em "L" para voltar (no Navi, use o botão Voltar), leitura de notificações, gestos de 3 dedos, deslizar para cima/baixo.
- No navegador não dá para saber se o TalkBack está ligado: marque **Uso leitor de tela** nas Preferências.
- Com a Voz ligada, tudo pede 2 toques; quem não precisa deve desligar a Voz.
- No app, **Pausar** não retoma do meio da frase: **Continuar** fala a frase de novo.
- A qualidade da voz depende do motor de voz instalado no celular (Google, Samsung); sem o português, o Android usa a voz padrão dele.
- Os lugares do mapa 3D ainda não são lidos com 1 toque (só a planta 2D).

## Perguntas para esta rodada

- 300 ms entre os 2 toques é um bom tempo? (`TAP_MAX_MS` em `js/leitor-gestos.js`)
- O deslize é reconhecido sempre? Arrastar devagar para explorar funciona? (`DESLIZE_MIN_PX`, `EXPLORAR_VELOCIDADE`)
- A voz do Android no seu celular é clara? Em que velocidade?
