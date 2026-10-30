// Carrega um local no Node (sem navegador), para os testes de rotas.
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const SITE = path.resolve(__dirname, '../../site-acessivel');
const R = require(path.join(SITE, 'js/rotas.js'));
const NL = require(path.join(SITE, 'js/local.js'));
const PR = require(path.join(SITE, 'js/preferencias-rota.js'));
function carregar(slug) {
  const reg = {};
  const ctx = { naviLocal: s => (reg[s] = reg[s] || {}), self: {}, window: {} };
  vm.createContext(ctx);
  for (const f of ['config', 'avisos', 'dados', 'grafo', 'malha', 'dados3d']) {
    const p = path.join(require('./local-node').pastaDoLocal(slug), f + '.js');
    if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx);
  }
  const local = NL.montar(slug, reg[slug]);
  R.usarMalha(local.malha);
  const G = R.criarGrafo11(local.grafo, local.lugares, { referencias: (local.config || {}).referencias });
  return { local, G, R, PR, lugar: nome => local.lugares.filter(l => l.nome === nome) };
}
module.exports = { carregar };
