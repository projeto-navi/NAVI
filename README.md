# Navi — Navegador Acessível de Vias Internas

Mapa interno acessível para pessoas com deficiência visual, auditiva ou de mobilidade.
Primeiro local: Shopping Estação (Curitiba). Próximo: UniOpet (1º semestre de 2027).

- Site: https://navi-map.netlify.app/
- Maquete com QR Code (apresentação): https://navi-qrcode.netlify.app/

## Pastas

| Pasta | Conteúdo |
|---|---|
| `site-acessivel/` | Site principal (HTML, CSS e JS puros, sem build). Publicado no Netlify. |
| `maquete-qr/` | Site separado da maquete 3D que vira QR Code. |
| `documentos/` | Documentos de apoio (Word): ideia, posicionamento, governança, regras de negócio, implantação UniOpet, arquitetura. |
| `materiais/` | Plano de Melhorias (PDF) e comparação antes/depois do celular. |
| `ferramentas/dados/` | Scripts que geram os dados do mapa a partir da planta (Node.js, Python + OpenCV). |
| `ferramentas/testes/` | Testes com Playwright (celular, desktop, primeira pessoa, avisos, voz). |
| `ferramentas/documentos/` | Geradores dos documentos Word e do PDF. |

## Publicar

Netlify → site → aba **Deploys** → arraste a pasta `site-acessivel` compactada em ZIP
(o ZIP inteiro, nunca só o `index.html`). O mesmo vale para `maquete-qr`.

## Equipe

| Nome | Curso | Papel |
|---|---|---|
| Camilly | Nutrição | Design e Negócios |
| Leonardo | Engenharia de Software | Líder Técnico |
| Erik | Engenharia de Software | Desenvolvedor |
| Lucas | Engenharia de Software | Desenvolvedor |

Os scripts de `ferramentas/` usam caminhos do ambiente onde foram escritos; ajuste-os antes de rodar.
