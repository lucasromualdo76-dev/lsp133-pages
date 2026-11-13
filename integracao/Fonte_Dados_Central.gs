/** Fonte única dos indicadores. Não importa dados nem altera as abas da planilha. */
function lspSourceCentralId_() {
  const id = String(PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID') || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new Error('Configure SOURCE_SPREADSHEET_ID com o ID da sua fonte central nas Propriedades do script.');
  return id;
}

function lspCentralReadRows_(name, width, headers) {
  const sheet = SpreadsheetApp.openById(lspSourceCentralId_()).getSheetByName(name);
  if (!sheet) throw new Error('Aba não encontrada na fonte central: ' + name);
  const rows = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), width).getDisplayValues();
  if (!headers.every((h, i) => rows[0][i] === h)) {
    throw new Error('Cabeçalhos alterados na fonte central: ' + name);
  }
  return rows;
}

function lspDashboardDate_(value) {
  const s = String(value == null ? '' : value).trim();
  let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s|$)/);
  let y, month, day;
  if (m) { y = +m[3]; month = +m[2]; day = +m[1]; }
  else {
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/);
    if (!m) return null;
    y = +m[1]; month = +m[2]; day = +m[3];
  }
  const d = new Date(Date.UTC(y, month - 1, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return String(y) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

/** Insucessos: cards globais; gráficos filtrados, preservando o contrato da área restrita. */
function lspCentralInsucessos_(filters) {
  const rows = lspCentralReadRows_('Fonte Insucessos', 14, ['Date', 'BR', 'Driver']);
  const f = filters || {};
  const within = date => (!f.from || date >= f.from) && (!f.to || date <= f.to);
  const returns = new Set(), days = new Map(), flyingDays = new Map();
  let returnRows = 0, flying = 0, other = 0, flyingMissingDate = 0;
  rows.slice(1).forEach(r => {
    const br = String(r[1] || '').trim().toUpperCase();
    if (br) {
      returnRows++;
      returns.add(br);
      const date = lspDashboardDate_(r[0]);
      if (date && within(date)) days.set(date, (days.get(date) || 0) + 1);
    }
    if (String(r[6] || '').trim() && String(r[8] || '').trim().toUpperCase() === 'VOANDO') {
      flying++;
      const date = lspDashboardDate_(r[5]);
      if (!date) flyingMissingDate++;
      else if (within(date)) flyingDays.set(date, (flyingDays.get(date) || 0) + 1);
    }
    if (String(r[11] || '').trim() && String(r[13] || '').trim().toUpperCase() === 'MISSORT') other++;
  });
  const total = returnRows + flying + other;
  return {
    uniqueReturns: returns.size, flying, other,
    flyingRate: (total ? 100 * flying / total : 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) + '%',
    daily: [...days].sort((a,b) => a[0].localeCompare(b[0])).map(([date, returns]) => ({date, returns})),
    flyingDaily: [...flyingDays].sort((a,b) => a[0].localeCompare(b[0])).map(([date, flying]) => ({date, flying})),
    flyingMissingDate
  };
}

/** Mesma unidade da área restrita atual: BR único por data e tipo. */
function lspCentralErros_(filters) {
  const rows = lspCentralReadRows_('Fonte Erros Expedição', 8, ['Data', 'Código BR', 'Tipo de erro', 'Operador registrado no SPX']);
  const f = filters || {}, seen = new Set(), days = new Map();
  rows.slice(1).forEach(r => {
    const date = lspDashboardDate_(r[0]);
    const br = String(r[1] || '').trim().toUpperCase();
    const type = String(r[2] || '').trim().toUpperCase();
    if (!date || !br || !type || (f.from && date < f.from) || (f.to && date > f.to)) return;
    const key = date + '|' + br + '|' + type;
    if (seen.has(key)) return;
    seen.add(key);
    if (!days.has(date)) days.set(date, {date, labelErrors:0, otherErrors:0});
    days.get(date)[type.includes('ETIQUETA') ? 'labelErrors' : 'otherErrors']++;
  });
  const daily = [...days.values()].sort((a,b) => a.date.localeCompare(b.date));
  return {daily, labelErrors:daily.reduce((n,r) => n + r.labelErrors, 0), otherErrors:daily.reduce((n,r) => n + r.otherErrors, 0)};
}

/** Verificação somente de estrutura: não publica nem lê nomes, BRs ou ATs no log. */
function testarFonteCentralDashboards() {
  assertAuthorized_();
  const book = SpreadsheetApp.openById(lspSourceCentralId_());
  const expected = [
    ['Folha 1', ['DATA','AT']],
    ['Base de Produção', ['DATA OPERACIONAL','AT','STATUS']],
    ['Histórico Diário', ['DATA DA CAPTURA','DATA OPERACIONAL']],
    ['Histórico Audit', ['DATA AUDIT','AT']],
    ['Atribuição de Entrega', ['Task ID','Station name']],
    ['Expedição Hoje', ['EXPEDIÇÃO DO DIA | DESDE ONTEM ÀS 21H | LSP 133']],
    ['Resumo de Expedição', ['HISTÓRICO DE EXPEDIÇÃO | LSP 133']],
    ['Fonte Insucessos', ['Date','BR','Driver']],
    ['Fonte Erros Expedição', ['Data','Código BR','Tipo de erro']]
  ];
  const result = expected.map(([name, headers]) => {
    const sheet = book.getSheetByName(name);
    if (!sheet) throw new Error('Aba ausente na central: ' + name);
    const actual = sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
    if (!headers.every((h,i) => actual[i] === h)) throw new Error('Cabeçalho inesperado: ' + name);
    return {aba:name, estrutura:'OK'};
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/** Executar após instalar os arquivos e ajustar as referências do Código.gs. */
function configurarFonteCentralDashboards() {
  testarFonteCentralDashboards();
  const id = lspSourceCentralId_();
  PropertiesService.getScriptProperties().setProperties({
    SOURCE_SPREADSHEET_ID:id,
    INSUCESSOS_SPREADSHEET_ID:id,
    ERROS_SPREADSHEET_ID:id
  });
  console.log('Referências da fonte central configuradas. Nenhum token, senha ou gatilho foi alterado.');
}
