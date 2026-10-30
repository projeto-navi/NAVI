# Navi — Navegador Acessível de Vias Internas

Mapa interno acessível para pessoas com deficiência visual, auditiva ou de mobilidade.
Mapa no site: prédio comercial de testes (testes kaizen das rotas acessíveis). O Shopping Estação, primeiro local, saiu do site em 30/10/2026; os dados ficam em `ferramentas/dados/locais-fora-do-site/`. Próximo: UniOpet — Campus Rebouças (1º semestre de 2027).

- Site: https://navi-map.netlify.app/
- Maquete com QR Code (apresentação): https://navi-qrcode.netlify.app/

## O site (Marco 1)

HTML, CSS e JavaScript puros, sem build e sem framework (abre até com dois cliques no `index.html`).

- **Página de Rota** (`index.html`): perfil, "Para onde você vai?" e "Por qual entrada você chegou?". Não tem mapa.
- **Página do Mapa** (`mapa.html`): mapa em tela cheia (2D; 3D e primeira pessoa quando pedidos) e o passo a passo num painel.
- Três temas do mesmo sistema: Claro (padrão), Alto contraste e Cores distintas (para daltonismo).
- Funciona sem internet depois da primeira visita e pode ser instalado na tela inicial (PWA).
- Vários locais: cada um mora em `site-acessivel/locais/<nome>/` e é escolhido por `?local=<nome>`.

Como usar, publicar e cuidar dos locais: [`site-acessivel/LEIA-ME.txt`](site-acessivel/LEIA-ME.txt).
Regras do produto: Documento 04 (`documentos/04-Regras-de-Negocio.docx`). Arquitetura: Documento 06.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `site-acessivel/` | O site. Publicado no Netlify. |
| `maquete-qr/` | Site separado da maquete 3D que vira QR Code. |
| `documentos/` | Documentos de apoio (Word): ideia, posicionamento e identidade, governança, regras de negócio, implantação UniOpet, arquitetura e relatório de aprendizagem. |
| `docs/superpowers/` | Especificação do Marco 1, estrutura da Fase 1 (identidade) e plano da M1a. |
| `testes/` | Testes com Playwright (dados, contraste dos temas, comportamento no celular e no computador, uso sem internet), servidor de teste e medição de desempenho. |
| `ferramentas/dados/` | Geram e validam os arquivos de cada local a partir da planta (Node.js, Python + OpenCV). |
| `ferramentas/identidade/` | Gera os ícones do site; tabela de contraste dos tokens. |
| `ferramentas/documentos/` | Geradores dos documentos Word, da figura de arquitetura e do PDF. |
| `ferramentas/testes/` | Scripts de captura de tela anteriores ao Marco 1. |
| `materiais/` | Plano de Melhorias (PDF) e comparação antes/depois do celular. |

## Testar

```bash
npm install                      # uma vez: Playwright e o Chromium
npm test                         # tudo: dados, identidade, celular (360 × 640) e computador (1440 × 900)
npm run test:dados               # só dados, grafo e arquivos do PWA
npm run servidor -- site-acessivel 4173        # http://127.0.0.1:4173/ (com gzip, como o Netlify)
npm run desempenho -- / 5 --h2                 # LCP, TBT e peso no perfil móvel (CPU 4×, Slow 4G), em HTTP/2
npm run desempenho -- "mapa.html?origem=1-1401928&destino=2-2482766" 5 --h2
npm run lighthouse                             # Lighthouse (precisa do pacote instalado)
```

Os testes de acessibilidade automática (axe-core) e o Lighthouse ficam pulados quando os pacotes não estão instalados.

## Publicar

A publicação é do Líder Técnico. Netlify → site → aba **Deploys** → arraste a pasta `site-acessivel` compactada em ZIP
(o ZIP inteiro, nunca só o `index.html`). A cada publicação, troque `VERSAO` no começo do `sw.js`:
quem estiver na Página de Rota recebe "Nova versão do Navi disponível". O mesmo vale para `maquete-qr` (sem o `sw.js`).

## Equipe

| Nome | Curso | Papel |
|---|---|---|
| Camilly | Nutrição | Design e Negócios |
| Leonardo | Engenharia de Software | Líder Técnico |
| Erik | Engenharia de Software | Desenvolvedor |
| Lucas | Engenharia de Software | Desenvolvedor |

Os scripts de Python em `ferramentas/dados/` e os de `ferramentas/testes/` usam caminhos do ambiente onde foram escritos; ajuste-os antes de rodar.
