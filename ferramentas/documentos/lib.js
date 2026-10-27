// Modelo comum dos documentos do Navi (docx-js).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, BorderStyle, ImageRun, Footer, Header, PageNumber, LevelFormat, PageBreak, TableLayoutType
} = require('docx');

const COR = { tinta: '2F3A44', suave: '5E6873', acento: '5A52E0', teal: '2C8F8A', linha: 'C9CFDA', fundo: 'F1F0FF', cinza: 'F2F4F7' };
const FONTE = 'Arial';
const LARG = 9638; // A4 com margens de 2 cm (11906 - 2*1134)

// **negrito** dentro do texto
function runs(texto, base = {}) {
  const out = [];
  String(texto).split(/(\*\*[^*]+\*\*)/).forEach(parte => {
    if (!parte) return;
    const b = parte.startsWith('**') && parte.endsWith('**');
    out.push(new TextRun({ text: b ? parte.slice(2, -2) : parte, bold: b || base.bold, color: base.color, size: base.size, italics: base.italics, font: FONTE }));
  });
  return out;
}
const p = (texto, o = {}) => new Paragraph({ children: runs(texto, o), spacing: { after: o.after ?? 120, line: 300 }, alignment: o.align });
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, children: [new TextRun({ text: t, font: FONTE })], spacing: { before: 320, after: 140 } });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun({ text: t, font: FONTE })], spacing: { before: 220, after: 100 } });
const ul = itens => itens.map(t => new Paragraph({ numbering: { reference: 'bolas', level: 0 }, children: runs(t), spacing: { after: 60, line: 288 } }));
const ol = (itens, ref = 'numeros') => itens.map(t => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60, line: 288 } }));
const nota = t => new Paragraph({
  children: runs(t, { size: 20, color: COR.suave }), spacing: { before: 60, after: 160, line: 276 },
  shading: { type: ShadingType.CLEAR, fill: COR.cinza, color: 'auto' },
  border: { left: { style: BorderStyle.SINGLE, size: 18, color: COR.acento, space: 6 } }
});
const quebra = () => new Paragraph({ children: [new PageBreak()] });

// tabela: cols = larguras relativas; head = cabeçalho; rows = linhas (texto com **negrito**)
function tabela(cols, head, rows, o = {}) {
  const soma = cols.reduce((a, b) => a + b, 0);
  const w = cols.map(c => Math.floor(c / soma * LARG));
  w[w.length - 1] += LARG - w.reduce((a, b) => a + b, 0);
  const borda = { style: BorderStyle.SINGLE, size: 4, color: COR.linha };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const cel = (txt, i, cab, fill) => new TableCell({
    width: { size: w[i], type: WidthType.DXA }, borders: bordas,
    shading: fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: String(txt).split('\n').map(linha => new Paragraph({ children: runs(linha, { size: o.size || 19, bold: cab, color: cab ? 'FFFFFF' : undefined }), spacing: { after: 30, line: 264 } }))
  });
  const linhas = [];
  if (head) linhas.push(new TableRow({ tableHeader: true, children: head.map((t, i) => cel(t, i, true, '3D4852')) }));
  rows.forEach((r, k) => linhas.push(new TableRow({ cantSplit: true, children: r.map((t, i) => cel(t, i, false, o.zebra !== false && k % 2 ? 'F7F8FA' : undefined)) })));
  return [new Table({ width: { size: LARG, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, rows: linhas }), new Paragraph({ spacing: { after: 120 }, children: [] })];
}

function imagem(caminho, larguraPx, alturaPx, legenda) {
  const out = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new ImageRun({ type: 'png', data: fs.readFileSync(caminho), transformation: { width: larguraPx, height: alturaPx } })] })];
  if (legenda) out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: runs(legenda, { size: 18, color: COR.suave, italics: true }), spacing: { after: 200 } }));
  return out;
}

const EQUIPE = [
  ['Camilly', 'Nutrição', 'Design e Negócios'],
  ['Leonardo', 'Engenharia de Software', 'Líder Técnico'],
  ['Erik', 'Engenharia de Software', 'Desenvolvedor'],
  ['Lucas', 'Engenharia de Software', 'Desenvolvedor']
];

function capa(numero, titulo, subtitulo, objetivo, versao = '1.0 — 26/10/2026') {
  const logo = fs.readFileSync(path.resolve(__dirname, '../../site-acessivel/img/icone-512.png'));
  return [
    new Paragraph({ spacing: { before: 600, after: 200 }, children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 84, height: 84 } })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'NAVI · Navegador Acessível de Vias Internas', font: FONTE, size: 22, color: COR.acento, bold: true })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `Documento ${numero}`, font: FONTE, size: 22, color: COR.suave })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: titulo, font: FONTE, size: 52, bold: true, color: COR.tinta })] }),
    new Paragraph({ spacing: { after: 360 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COR.acento, space: 10 } },
      children: [new TextRun({ text: subtitulo, font: FONTE, size: 26, color: COR.suave })] }),
    ...(objetivo ? [p(`**Para que serve:** ${objetivo}`, { after: 240 })] : []),
    ...tabela([1, 2.2], null, [
      ['**Projeto**', 'Navi — mapa interno acessível para pessoas com deficiência visual, auditiva ou de mobilidade'],
      ['**Site**', 'https://navi-map.netlify.app/'],
      ['**Versão**', versao],
      ['**Equipe**', EQUIPE.map(e => `${e[0]} — ${e[2]} (${e[1]})`).join('\n')]
    ], { zebra: false, size: 20 }),
    quebra()
  ];
}

async function gerar(arquivo, tituloCurto, conteudo) {
  const doc = new Document({
    creator: 'Equipe Navi', title: tituloCurto,
    styles: {
      default: { document: { run: { font: FONTE, size: 21, color: COR.tinta } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: COR.acento, font: FONTE }, paragraph: { outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: COR.tinta, font: FONTE }, paragraph: { outlineLevel: 1 } }
      ]
    },
    numbering: { config: [
      { reference: 'bolas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 260 } } } }] },
      ...['numeros', 'n2', 'n3', 'n4', 'n5', 'n6'].map(ref => ({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 500, hanging: 320 } } } }] }))
    ] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Navi · ${tituloCurto}`, font: FONTE, size: 16, color: COR.suave })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: FONTE, size: 16, color: COR.suave })] })] }) },
      children: conteudo.flat()
    }]
  });
  fs.writeFileSync(arquivo, await Packer.toBuffer(doc));
}

module.exports = { p, h1, h2, ul, ol, nota, tabela, imagem, capa, gerar, quebra, EQUIPE };
