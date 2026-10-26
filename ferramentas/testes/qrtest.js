const Q = require('/mnt/user-data/outputs/site-acessivel/js/qrcodigo.js');
const casos = [];
const textos = ['https://navi-map.netlify.app/', 'https://navi-map.netlify.app/?perfil=mobilidade&origem=1-1401928', 'Olá, Navi! Acessível ção', 'A', 'https://navi-map.netlify.app/maquete/?x=1234567890abcdefghij1234567890abcdefghij1234567890abcdefghijklmnopq'];
for (const t of textos) for (const n of ['L', 'M', 'Q', 'H']) for (const mk of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) {
  try { const q = Q.gerar(t, n, mk); casos.push({ t, n, mk, v: q.versao, m: q.modulos.map(r => r.map(b => b ? 1 : 0)) }); } catch (e) { casos.push({ t, n, mk, erro: e.message }); }
}
require('fs').writeFileSync('/tmp/claude-0/s/qrcasos.json', JSON.stringify(casos));
console.log(casos.length, 'casos; versão da URL principal (Q):', Q.gerar(textos[0], 'Q').versao, 'tamanho', Q.gerar(textos[0], 'Q').tamanho);
