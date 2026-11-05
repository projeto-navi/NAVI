# App Android do Navi (teste)

O app guarda uma cópia do site (`site-acessivel/`) e acrescenta o que o navegador não dá: ler os beacons Bluetooth do prédio. Regras propostas: RN71 a RN74 do Documento 04 (aguardando aprovação).

## Como o APK é gerado

Não precisa instalar nada no computador. A cada push na branch `app/android` que mexe no site ou nesta pasta, o GitHub Actions (`.github/workflows/apk.yml`):

1. instala o Capacitor 8 e o plugin `@capacitor-community/bluetooth-le`;
2. copia o site para `www/` (`npm run copiar-site`);
3. cria o projeto Android (`npx cap add android`; a pasta `android/` não fica no repositório);
4. aplica permissões, chave de teste e ícone (`npm run ajustar-android`);
5. monta o APK e publica o artefato **navi-teste**.

Também dá para rodar na mão: **Actions → APK de teste → Run workflow**.

## Baixar e instalar

1. **Actions → APK de teste** → execução mais recente com ✓ verde → **Artifacts → navi-teste**. O APK está dentro do `.zip`.
2. Passe o `navi-teste.apk` para o celular (cabo, Drive ou WhatsApp) e abra.
3. Permita "instalar apps desconhecidos" para o app que abriu o arquivo. No aviso do Play Protect: **Mais detalhes → Instalar mesmo assim**.
4. As próximas versões instalam por cima: todas usam a mesma chave de teste.

## Chave de teste

`chave-teste/navi-teste.jks`, alias `navi-teste`, senha `navi-teste`. Ela é pública de propósito e serve **só para testes**. Para a Play Store será outra chave, guardada fora do repositório.

## Permissões que o app pede

- Bluetooth (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`; no Android 11 ou anterior, `BLUETOOTH` e `BLUETOOTH_ADMIN`).
- Localização (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`). O GPS não é usado, mas o Android exige a localização ligada para procurar beacons. A busca **não** usa `neverForLocation`, porque essa marca faz o Android esconder beacons.

## Testar sem beacons

Use um segundo celular Android com o app gratuito **Beacon Simulator**. Crie um iBeacon com UUID `FDA50693-A4E2-4FB1-AFCF-C6EB07647825`, major `1` e o minor do lugar:

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

O roteiro completo, com a ficha de retorno e as limitações, está em `docs/kaizen/app-beacons-roteiro.md`.

## Beacons reais

Quando os FSC-BP108B chegarem, abra **Preferências → Beacons por perto** no app, anote os números de cada um (ou use **Copiar números**) e atualize `site-acessivel/locais/predio-teste/beacons.js`. Depois, gere um APK novo.
