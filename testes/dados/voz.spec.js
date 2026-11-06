// Voz do Navi: motor nativo (voz do Android no app), navegador ou nenhum, e o TalkBack do celular (RN77, RN78).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, expect } = require('@playwright/test');
const SITE = path.join(__dirname, '..', '..', 'site-acessivel');

function contexto(extra = {}) {
  const ctx = { setTimeout, clearTimeout, console, ...extra };
  vm.createContext(ctx);
  for (const f of ['js/voz.js', 'js/leitor-celular.js']) vm.runInContext(fs.readFileSync(path.join(SITE, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
function ttsFalso() {
  const chamadas = [];
  return { chamadas, speak: async o => { chamadas.push(['speak', o]); }, stop: async () => { chamadas.push(['stop']); } };
}
const prefsCom = (o = {}) => () => ({ voz: true, leitorDeTela: false, velocidade: 'normal', perfil: 'visual', libras: false, ...o });
const regiaoFalsa = () => ({ textContent: '' });

test.describe('NaviVoz: motor', () => {
  test('motorPadrao: app com TextToSpeech → nativo; só speechSynthesis → navegador; nada → nenhum', () => {
    const tts = ttsFalso();
    let c = contexto({ Capacitor: { isNativePlatform: () => true, Plugins: { TextToSpeech: tts } } });
    expect(c.NaviVoz.motorPadrao(c).tipo).toBe('nativo');
    c = contexto({ speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [] }, SpeechSynthesisUtterance: function () {} });
    expect(c.NaviVoz.motorPadrao(c).tipo).toBe('navegador');
    c = contexto({ Capacitor: { isNativePlatform: () => false, Plugins: { TextToSpeech: tts } } });
    expect(c.NaviVoz.motorPadrao(c).tipo).toBe('nenhum');
  });

  test('no app, fala pela voz do Android em pt-BR, interrompendo a fala anterior, na velocidade escolhida', () => {
    const tts = ttsFalso();
    const c = contexto({ Capacitor: { isNativePlatform: () => true, Plugins: { TextToSpeech: tts } } });
    let vel = 'normal';
    const voz = c.NaviVoz.criar({ regiao: regiaoFalsa(), prefs: () => prefsCom({ velocidade: vel })() });
    expect(voz.temVoz).toBe(true);
    expect(voz.motor).toBe('nativo');
    expect(voz.falar('Oi')).toBe(true);
    expect(tts.chamadas.at(-1)).toEqual(['speak', { text: 'Oi', lang: 'pt-BR', rate: 1, queueStrategy: 0 }]);
    vel = 'devagar'; voz.falar('Devagar');
    expect(tts.chamadas.at(-1)[1].rate).toBe(0.8);
    vel = 'rapido'; voz.falar('Rápido');
    expect(tts.chamadas.at(-1)[1].rate).toBe(1.25);
  });

  test('no app: cancelar para; pausar para e continuar repete a frase do começo', () => {
    const tts = ttsFalso();
    const c = contexto({ Capacitor: { isNativePlatform: () => true, Plugins: { TextToSpeech: tts } } });
    const voz = c.NaviVoz.criar({ regiao: regiaoFalsa(), prefs: prefsCom() });
    voz.falar('Passo 1. Siga em frente.');
    voz.pausar();
    expect(tts.chamadas.at(-1)).toEqual(['stop']);
    expect(voz.pausada).toBe(true);
    voz.continuar();
    expect(tts.chamadas.at(-1)).toEqual(['speak', expect.objectContaining({ text: 'Passo 1. Siga em frente.' })]);
    expect(voz.pausada).toBe(false);
    voz.cancelar();
    expect(tts.chamadas.at(-1)).toEqual(['stop']);
  });

  test('sem motor nenhum: temVoz falso e falar não faz nada', () => {
    const c = contexto();
    const voz = c.NaviVoz.criar({ regiao: regiaoFalsa(), prefs: prefsCom() });
    expect(voz.temVoz).toBe(false);
    expect(voz.falar('Oi')).toBe(false);
  });

  test('TalkBack do celular ligado: o Navi não fala, mas a região aria-live continua recebendo os avisos', async () => {
    const tts = ttsFalso();
    const c = contexto({ Capacitor: { isNativePlatform: () => true, Plugins: { TextToSpeech: tts } } });
    const regiao = regiaoFalsa();
    const voz = c.NaviVoz.criar({ regiao, prefs: prefsCom() });
    voz.definirLeitorCelular(true);
    expect(voz.pausadaPeloLeitor).toBe(true);
    expect(tts.chamadas.at(-1)).toEqual(['stop']);
    const antes = tts.chamadas.length;
    expect(voz.falar('Oi')).toBe(false);
    voz.anunciar('Rota pronta');
    await new Promise(r => setTimeout(r, 60));
    expect(regiao.textContent).toBe('Rota pronta');
    expect(tts.chamadas.length).toBe(antes);
    voz.definirLeitorCelular(false);
    expect(voz.falar('Oi')).toBe(true);
  });
});

test.describe('NaviLeitorCelular', () => {
  test('no app, pergunta ao ScreenReader e avisa quando muda', async () => {
    let ouvinte = null;
    const plugin = { isEnabled: async () => ({ value: true }), addListener: async (ev, fn) => { if (ev === 'stateChange') ouvinte = fn; return { remove() {} }; } };
    const c = contexto();
    const lc = c.NaviLeitorCelular.criar({ plugin });
    expect(await lc.ligado()).toBe(true);
    const mudou = [];
    lc.aoMudar(v => mudou.push(v));
    await new Promise(r => setTimeout(r, 0));
    ouvinte({ value: false });
    expect(mudou).toEqual([false]);
  });

  test('no navegador (sem plugin), o TalkBack nunca é detectado', async () => {
    const c = contexto();
    expect(await c.NaviLeitorCelular.criar().ligado()).toBe(false);
  });

  test('no app, sem plugin explícito, usa Capacitor.Plugins.ScreenReader', async () => {
    const c = contexto({ Capacitor: { isNativePlatform: () => true, Plugins: { ScreenReader: { isEnabled: async () => ({ value: true }), addListener: async () => ({ remove() {} }) } } } });
    expect(await c.NaviLeitorCelular.criar().ligado()).toBe(true);
  });
});
