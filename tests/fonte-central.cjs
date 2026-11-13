const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const root = path.resolve(__dirname, '..');
const helper = fs.readFileSync(path.join(root, 'integracao/Fonte_Dados_Central.gs'), 'utf8');
const restricted = fs.readFileSync(path.join(root, 'integracao/Restricted.gs'), 'utf8');
const rows = {
  'Fonte Insucessos': [
    ['Date','BR','Driver'],
    ['01/11/2026','BR1',''],
    ['01/11/2026','BR1',''],
    ['02/11/2026','BR2','','','','02/11/2026','BR3','','VOANDO'],
    ['','','','','','','BR4','','VOANDO'],
    ['','','','','','','','','','','02/11/2026','BR5','','MISSORT']
  ],
  'Fonte Erros Expedição': [
    ['Data','Código BR','Tipo de erro','Operador registrado no SPX'],
    ['01/11/2026','BR1','Etiqueta variada',''],
    ['01/11/2026','BR1','Etiqueta variada',''],
    ['02/11/2026','BR1','Duplicidade',''],
    ['02/11/2026','BR2','Erro Fleet',''],
    ['','BR3','Duplicidade',''],
    ['31/02/2026','BR4','Etiqueta variada','']
  ]
};
let reads = [], writes = 0;
const ctx = {
  console,
  PropertiesService: {getScriptProperties:()=>({getProperty:key=>key==='SOURCE_SPREADSHEET_ID'?'central_fixture_12345678901234567890':null})},
  SpreadsheetApp: {openById(id) {
    assert.equal(id, 'central_fixture_12345678901234567890');
    return {getSheetByName(name) {
      reads.push(name);
      if (!rows[name]) return null;
      return {getLastRow:()=>rows[name].length, getRange:(r,c,n,w)=>({
        getDisplayValues:()=>rows[name].slice(r-1,r-1+n).map(row=>Array.from({length:w},(_,i)=>row[c-1+i]||''))
      })};
    }};
  }},
  normalizeFilters_: f => f,
  Utilities: {formatDate:()=> '12/11/2026 22:00:00'},
};
vm.createContext(ctx);
vm.runInContext(helper + '\n' + restricted, ctx);
ctx.restrictedRequireSession_ = token => {if(token !== 'valid') throw new Error('Acesso restrito');};
assert.throws(()=>ctx.restrictedGetData('bad','insucessos',{}), /Acesso restrito/);
assert.equal(reads.length, 0, 'Acesso negado antes de ler dados');
const ins = ctx.restrictedGetData('valid','insucessos',{from:'2026-11-02',to:'2026-11-02'});
assert.equal(ins.uniqueReturns, 2, 'Cards globais não somam BR repetido');
assert.equal(ins.flying, 2);
assert.equal(ins.other, 1);
assert.equal(ins.flyingMissingDate, 1);
assert.equal(ins.daily.length, 1);
assert.equal(ins.daily[0].returns, 1);
assert.equal(ins.flyingDaily[0].flying, 1);
const errs = ctx.restrictedGetData('valid','erros',{});
assert.equal(errs.labelErrors, 1, 'Mesmo BR/data/tipo contado uma vez');
assert.equal(errs.otherErrors, 2, 'Duplicidade e Fleet preservados');
const filtered = ctx.restrictedGetData('valid','erros',{from:'2026-11-02',to:'2026-11-02'});
assert.equal(filtered.labelErrors, 0);
assert.equal(filtered.otherErrors, 2);
assert.equal(ctx.lspDashboardDate_('31/02/2026'), null);
assert.equal(ctx.lspDashboardDate_('12-11-2026 22:30'), '2026-11-12');
assert.equal(ctx.lspDashboardDate_('2026-11-12'), '2026-11-12');
rows['Fonte Erros Expedição'][0][0] = 'Mudou';
assert.throws(()=>ctx.restrictedGetData('valid','erros',{}), /Cabeçalhos alterados/);
const sync = fs.readFileSync(path.join(root,'integracao/AppsScript_Sync_LSP133.gs'),'utf8');
new vm.Script(helper+'\n'+sync);
const index = fs.readFileSync(path.join(root,'index.html'),'utf8');
const scripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
for (const [,script] of scripts) new vm.Script(script);
assert(index.includes("corporate(document.getElementById('eti')"));
const data = JSON.parse(fs.readFileSync(path.join(root,'data/indicadores.json'),'utf8'));
assert(!('insucessos' in data));
assert(!('erros' in data));
console.log('PASS: acesso antes de leituras, fonte central, cards globais/séries filtradas, deduplicação, tipos adicionais, datas, cabeçalhos e sintaxe dos scripts.');
