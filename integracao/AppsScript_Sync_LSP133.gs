/**
 * Sincronização LSP 133 -> GitHub Pages.
 * Publica somente indicadores agregados.
 *
 * Propriedades do Script:
 * Fonte_Dados_Central.gs deve estar instalado no mesmo projeto.
 * SOURCE_SPREADSHEET_ID (configurado por configurarFonteCentralDashboards)
 * GITHUB_TOKEN
 * PUBLICATION_APPROVED = YES
 * INSUCESSOS_SPREADSHEET_ID e ERROS_SPREADSHEET_ID:
 * usados apenas pela área restrita; não publicados por este sincronizador.
 *
 * Testar: syncLsp133ToGitHub
 * Ativar rotina: installLsp133SyncTrigger
 * Parar rotina: stopLsp133SyncTrigger
 *
 * Rotas concluídas preservadas e ausentes da carga atual são
 * reconhecidas na validação, sem inventar datas de conclusão.
 */

const LSP133_PUBLIC = {
  repo: 'lucasromualdo76-dev/lsp133-pages',
  path: 'data/indicadores.json'
};

function lspPublicDate_(x) {
  if (x instanceof Date && !isNaN(x)) {
    return Utilities.formatDate(
      x, 'America/Sao_Paulo', 'yyyy-MM-dd'
    );
  }

  const m = String(x || '').match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
}

function lspEventDate_(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(
      v, 'America/Sao_Paulo', 'yyyy-MM-dd'
    );
  }

  const s = String(v == null ? '' : v).trim();
  if (!s) return null;

  let m = s.match(
    /^(\d{2})[-\/](\d{2})[-\/](\d{4})(?:\s|$)/
  );

  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const d = new Date(Date.UTC(year, month - 1, day));

    if (
      d.getUTCDate() === day &&
      d.getUTCMonth() === month - 1
    ) {
      return m[3] + '-' + m[2] + '-' + m[1];
    }
  }

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T]|$)/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

function lspPublicNumber_(v) {
  return (
    v !== '' &&
    v != null &&
    Number.isFinite(Number(v)) &&
    Number(v) >= 0
  );
}

/**
 * Reconstrói eventos da carga atual.
 *
 * A = AT
 * U = Complete time
 * V = Driver Assigned Time
 * W = status atual
 *
 * Linhas de pacotes da mesma AT não duplicam a rota.
 */
function lspRouteEvents_(ss, knownIds) {
  const sheet = ss.getSheetByName('Atribuição de Entrega');

  if (!sheet) {
    throw new Error(
      'Aba Atribuição de Entrega não localizada.'
    );
  }

  const events = new Map();
  const last = sheet.getLastRow();
  const block = 15000;

  let differing = 0;
  let rawRows = 0;

  for (let begin = 2; begin <= last; begin += block) {
    const length = Math.min(block, last - begin + 1);

    const ids = sheet
      .getRange(begin, 1, length, 1)
      .getDisplayValues();

    const vals = sheet
      .getRange(begin, 21, length, 3)
      .getDisplayValues();

    for (let i = 0; i < length; i++) {
      const at = String(ids[i][0] || '').trim();

      if (!knownIds.has(at)) continue;
      rawRows++;

      const u = lspEventDate_(vals[i][0]);
      const v = lspEventDate_(vals[i][1]);

      const status = String(vals[i][2] || '')
        .trim()
        .toLowerCase();

      if (!events.has(at)) {
        events.set(at, {
          assignedDate: v,
          completedDate: u,
          status
        });
        continue;
      }

      const prior = events.get(at);

      for (const [key, value] of [
        ['assignedDate', v],
        ['completedDate', u],
        ['status', status]
      ]) {
        if (!value) continue;

        if (prior[key] && prior[key] !== value) {
          differing++;
          continue;
        }

        if (!prior[key]) prior[key] = value;
      }
    }
  }

  if (differing) {
    throw new Error(
      'Conflito em linhas duplicadas da Atribuição de Entrega: ' +
      differing
    );
  }

  const byDate = new Map();

  const add = date => {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        assigned: 0,
        completed: 0,
        assignedCurrent: 0,
        completedCurrent: 0
      });
    }

    return byDate.get(date);
  };

  let missingAssignedTime = 0;
  let missingCompleteTime = 0;
  let completedRoutes = 0;
  let assignedRoutes = 0;

  for (const [at, rec] of events) {
    if (
      rec.status === 'assigned' ||
      rec.status === 'complete'
    ) {
      assignedRoutes++;

      if (rec.assignedDate) {
        const day = add(rec.assignedDate);
        day.assigned++;

        if (rec.status === 'assigned') {
          day.assignedCurrent++;
        } else {
          day.completedCurrent++;
        }
      } else {
        missingAssignedTime++;
      }
    }

    if (rec.status === 'complete') {
      completedRoutes++;

      if (rec.completedDate) {
        add(rec.completedDate).completed++;
      } else {
        missingCompleteTime++;
      }
    }
  }

  const days = [...byDate.values()].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  return {
    // Uso interno na validação; não publicado no JSON.
    routeStatuses: new Map(
      [...events].map(([at, rec]) => [at, rec.status])
    ),
    days,
    quality: {
      rowsScanned: last - 1,
      matchedRows: rawRows,
      uniqueRoutes: events.size,
      assignedRoutes,
      completedRoutes,
      missingAssignedTime,
      missingCompleteTime,
      firstEventDate: days[0] ? days[0].date : null,
      lastEventDate: days.length
        ? days[days.length - 1].date
        : null
    }
  };
}

/**
 * Reconcilia concluídas por AT.
 *
 * Aceita:
 * - Completa na Folha 1 e Complete na carga atual;
 * - Completa na Folha 1, ausente da carga atual e
 *   confirmada como Completa em ATs Preservadas.
 *
 * Status divergente na carga atual continua bloqueando.
 */
function lspValidateCompleted_(ss, pr, eventData) {
  const norm = v => String(v || '').trim().toLowerCase();

  const completeIds = new Set(
    pr.filter(r =>
      String(r[1] || '').trim() &&
      norm(r[5]) === 'completa'
    ).map(r => String(r[1]).trim())
  );

  const sheet = ss.getSheetByName('ATs Preservadas');

  const rows = sheet && sheet.getLastRow() > 1
    ? sheet.getRange(
        2, 1, sheet.getLastRow() - 1, 6
      ).getValues()
    : [];

  const preserved = new Map();

  for (const r of rows) {
    const at = String(r[1] || '').trim();
    if (!at) continue;

    const status = norm(r[5]);

    if (
      preserved.has(at) &&
      preserved.get(at) !== status
    ) {
      throw new Error(
        'Status conflitantes em ATs Preservadas: ' + at
      );
    }

    preserved.set(at, status);
  }

  let preservedOutsideCurrentLoad = 0;

  for (const at of completeIds) {
    if (eventData.routeStatuses.get(at) === 'complete') {
      continue;
    }

    if (
      !eventData.routeStatuses.has(at) &&
      preserved.get(at) === 'completa'
    ) {
      preservedOutsideCurrentLoad++;
      continue;
    }

    throw new Error(
      'AT Completa na Folha 1 sem confirmação compatível: ' +
      at
    );
  }

  for (const [at, status] of eventData.routeStatuses) {
    if (status === 'complete' && !completeIds.has(at)) {
      throw new Error(
        'AT Complete na carga atual diverge da Folha 1: ' +
        at
      );
    }
  }

  eventData.quality.completedRoutesInFolha =
    completeIds.size;

  eventData.quality.preservedCompletedOutsideCurrentLoad =
    preservedOutsideCurrentLoad;

  console.log(
    'Concluídas na Folha 1: ' + completeIds.size +
    '; preservadas fora da carga atual: ' +
    preservedOutsideCurrentLoad
  );
}

function syncLsp133ToGitHub() {
  const cfg = PropertiesService.getScriptProperties();

  if (cfg.getProperty('PUBLICATION_APPROVED') !== 'YES') {
    throw new Error(
      'Publicação pública ainda não autorizada. ' +
      'Obtenha aprovação corporativa para divulgar os indicadores.'
    );
  }

  const token = cfg.getProperty('GITHUB_TOKEN');

  if (!token) {
    throw new Error(
      'Configure GITHUB_TOKEN nas Propriedades do script.'
    );
  }

  const spreadsheetId = lspSourceCentralId_();

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const p = ss.getSheetByName('Folha 1');
  const e = ss.getSheetByName('Resumo de Expedição');

  if (!p || !e) {
    throw new Error(
      'Não encontrei Folha 1 ou Resumo de Expedição.'
    );
  }

  const map = new Map();
  const atSet = new Set();

  const make = date => {
    if (!map.has(date)) {
      map.set(date, {
        date,
        routesOut: 0,
        routesFloor: 0,
        packagesOut: 0,
        packagesFloor: 0,
        pendingPackagesOut: 0,
        pendingPackagesFloor: 0,
        assigned: 0,
        complete: 0,
        assignedTotal: 0
      });
    }

    return map.get(date);
  };

  // Fonte usada pelo painel original, sem ATs desmanchadas.
  const production = lspReadProduction_(ss);
  const pr = production.rows;

  for (const r of pr) {
    const at = String(r[1] || '').trim();
    if (!at) continue;

    const date = lspPublicDate_(r[0]);

    if (!date) {
      throw new Error(
        'Data ausente na Base de Produção: interrompido.'
      );
    }

    if (atSet.has(at)) {
      throw new Error(
        'AT duplicada na Base de Produção: interrompido.'
      );
    }

    atSet.add(at);

    const x = make(date);
    const st = String(r[5] || '').trim().toLowerCase();

    x.routesObserved = true;

    if (st === 'expedida' || st === 'completa') {
      x.routesOut++;

      if (lspPublicNumber_(r[3])) {
        x.packagesOut += Number(r[3]);
      } else {
        x.pendingPackagesOut++;
      }
    } else if (
      st === 'audit completo' ||
      st === 'pendente de audit'
    ) {
      x.routesFloor++;

      if (lspPublicNumber_(r[3])) {
        x.packagesFloor += Number(r[3]);
      } else {
        x.pendingPackagesFloor++;
      }
    } else {
      throw new Error(
        'Status inesperado na Folha 1: ' + st
      );
    }
  }

  if (atSet.size === 0) {
    throw new Error(
      'Base de Produção vazia; publicação interrompida.'
    );
  }

  // Mantém os valores do Resumo de Expedição.
  const er = e.getLastRow() > 3
    ? e.getRange(4, 1, e.getLastRow() - 3, 4).getValues()
    : [];

  const dateSet = new Set();

  for (const r of er) {
    const date = lspPublicDate_(r[0]);
    if (!date) continue;

    const a = Number(r[1]);
    const c = Number(r[2]);
    const t = Number(r[3]);

    if (
      ![a, c, t].every(
        n => Number.isInteger(n) && n >= 0
      ) ||
      a + c !== t
    ) {
      throw new Error(
        'Totais de atribuição inconsistentes em ' + date
      );
    }

    if (dateSet.has(date)) {
      throw new Error(
        'Data repetida no resumo de atribuições: ' + date
      );
    }

    dateSet.add(date);

    const x = make(date);
    x.assigned = a;
    x.complete = c;
    x.assignedTotal = t;
    x.assignmentRecorded = true;
  }

  // Detalhamento por data de atribuição e operacional.
  const assignmentOrigins = [];

  const breakdown = e.getLastRow() > 3
    ? e.getRange(4, 7, e.getLastRow() - 3, 5).getValues()
    : [];

  const totalsByAssignment = new Map();
  const originKeys = new Set();

  for (const r of breakdown) {
    const assignmentDate = lspPublicDate_(r[0]);
    const operationalDate = lspPublicDate_(r[1]);

    if (!assignmentDate && !operationalDate) continue;

    if (!assignmentDate || !operationalDate) {
      throw new Error(
        'Data ausente no detalhamento G:K de atribuições.'
      );
    }

    const assigned = Number(r[2]);
    const complete = Number(r[3]);
    const total = Number(r[4]);

    if (
      ![assigned, complete, total].every(
        n => Number.isInteger(n) && n >= 0
      ) ||
      assigned + complete !== total
    ) {
      throw new Error(
        'Detalhamento G:K inconsistente: ' +
        assignmentDate + ' / ' + operationalDate
      );
    }

    const key = assignmentDate + '|' + operationalDate;

    if (originKeys.has(key)) {
      throw new Error(
        'Origem duplicada no resumo de atribuições: ' + key
      );
    }

    originKeys.add(key);

    assignmentOrigins.push({
      assignmentDate,
      operationalDate,
      assigned,
      complete,
      total
    });

    totalsByAssignment.set(
      assignmentDate,
      (totalsByAssignment.get(assignmentDate) || 0) + total
    );
  }

  for (const [date, total] of totalsByAssignment) {
    const expected = map.get(date);

    if (
      !expected ||
      !expected.assignmentRecorded ||
      Number(expected.assignedTotal) !== total
    ) {
      throw new Error(
        'Detalhamento G:K diverge do resumo A:D em ' +
        date + ': detalhamento=' + total +
        ', resumo=' +
        (expected ? expected.assignedTotal : 'ausente')
      );
    }
  }

  const recordedDates = [...dateSet].sort();

  const assignmentCoverage = {
    firstRecordedDate: recordedDates.length
      ? recordedDates[0]
      : null,
    lastRecordedDate: recordedDates.length
      ? recordedDates[recordedDates.length - 1]
      : null,
    recordedDays: recordedDates.length
  };

  // Confere com a Folha 1 excluindo as ATs desmanchadas.
  const actual = production.expected;

  const days = [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  const measured = [
    'routesOut',
    'packagesOut',
    'routesFloor',
    'packagesFloor'
  ].map(k => days.reduce((n, d) => n + d[k], 0));

  if (
    !actual.every(
      (v, i) => Number.isFinite(v) && v === measured[i]
    )
  ) {
    throw new Error(
      'Divergência na produção após excluir desmanchadas: ' +
      'planilha=' + JSON.stringify(actual) +
      '; sync=' + JSON.stringify(measured)
    );
  }

  // Última captura por data operacional.
  const hist = ss.getSheetByName('Histórico Diário');
  const latest = new Map();

  if (hist && hist.getLastRow() > 1) {
    const h = hist.getRange(
      2, 1, hist.getLastRow() - 1, 12
    ).getValues();

    for (const row of h) {
      const date = lspPublicDate_(row[1]);
      if (!date) continue;

      const stamp = row[10] instanceof Date
        ? row[10].toISOString()
        : String(row[10] || '');

      const prev = latest.get(date);
      if (prev && prev.stamp > stamp) continue;

      latest.set(date, {
        stamp,
        date,
        routesOut: Number(row[2]) || 0,
        routesFloor: Number(row[3]) || 0,
        packagesOut: Number(row[4]) || 0,
        packagesFloor: Number(row[5]) || 0,
        pendingPackagesOut: Number(row[7]) || 0,
        pendingPackagesFloor: Number(row[8]) || 0,
        snapshotType: String(row[9] || ''),
        snapshotAt: stamp
      });
    }
  }

  const history = [...latest.values()].sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  // Insucessos e Erros são consultados exclusivamente na área restrita.

  const eventData = lspRouteEvents_(ss, atSet);

  // Correção: reconciliação por AT, incluindo preservadas.
  lspValidateCompleted_(ss, pr, eventData);

  const body = {
    mode: 'REAL_AGGREGATED',
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'Validação de Dados - Fonte Dashboard - Lucas / Base de Produção / Resumo de Expedição',
    coverage: {
      routes: atSet.size,
      excludedDemolishedRoutes: production.excludedRoutes,
      assignmentDays: dateSet.size,
      assignment: assignmentCoverage
    },
    days,
    history,
    assignmentOrigins,
    assignmentTimeline: eventData.days,
    eventQuality: eventData.quality,
    expeditionTurn: expeditionPublicSummary_(ss, new Date())
  };

  const url =
    'https://api.github.com/repos/' +
    LSP133_PUBLIC.repo +
    '/contents/' +
    LSP133_PUBLIC.path;

  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const prior = UrlFetchApp.fetch(url, {
    headers,
    muteHttpExceptions: true
  });

  let sha;

  if (prior.getResponseCode() === 200) {
    sha = JSON.parse(prior.getContentText()).sha;
  } else if (prior.getResponseCode() !== 404) {
    throw new Error(
      'GitHub leitura: HTTP ' + prior.getResponseCode()
    );
  }

  const payload = {
    message: 'data: atualizar indicadores agregados da operação',
    branch: 'main',
    content: Utilities.base64Encode(
      JSON.stringify(body, null, 2),
      Utilities.Charset.UTF_8
    )
  };

  if (sha) payload.sha = sha;

  const updated = UrlFetchApp.fetch(url, {
    method: 'put',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (![200, 201].includes(updated.getResponseCode())) {
    throw new Error(
      'GitHub escrita: HTTP ' +
      updated.getResponseCode() + ' ' +
      updated.getContentText().slice(0, 250)
    );
  }

  console.log(
    'Publicado JSON agregado: ' +
    days.length + ' datas; ' +
    atSet.size + ' rotas na Base de Produção'
  );
}

function installLsp133SyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(x =>
      x.getHandlerFunction() === 'syncLsp133ToGitHub'
    )
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('syncLsp133ToGitHub')
    .timeBased()
    .everyMinutes(15)
    .create();
}

function stopLsp133SyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(x =>
      x.getHandlerFunction() === 'syncLsp133ToGitHub'
    )
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}
/** Base de Produção já exclui as ATs marcadas como Desmanchada.
 * Confere a base por AT contra a Folha 1 menos o controle de desmanche.
 * Divergências ou base desatualizada bloqueiam a publicação.
 */
function lspReadProduction_(ss) {
  const base = ss.getSheetByName('Base de Produção');
  const folha = ss.getSheetByName('Folha 1');
  const control = ss.getSheetByName('Controle ATs Desmanchadas');
  if (!base || !folha || !control) {
    throw new Error('Não encontrei Base de Produção, Folha 1 ou Controle ATs Desmanchadas.');
  }
  const norm = v => String(v || '').trim().toLowerCase();
  const headers = base.getRange('A1:F1').getDisplayValues()[0];
  const expectedHeaders = ['DATA OPERACIONAL','AT','STATUS','PACOTES TOTAIS','PACOTES EXPEDIDOS','VALIDAÇÃO'];
  if (!expectedHeaders.every((v,i) => headers[i] === v)) {
    throw new Error('Cabeçalhos da Base de Produção alterados.');
  }
  const controlHeaders = control.getRange('A1:D1').getDisplayValues()[0];
  if (controlHeaders[1] !== 'AT' || controlHeaders[3] !== 'SITUAÇÃO') {
    throw new Error('Cabeçalhos do Controle ATs Desmanchadas alterados.');
  }
  const read = (sheet, width) => sheet.getLastRow() > 1
    ? sheet.getRange(2,1,sheet.getLastRow()-1,width).getValues() : [];
  const excluded = new Set(read(control,4)
    .filter(r => norm(r[3]) === 'desmanchada')
    .map(r => String(r[1] || '').trim()).filter(Boolean));
  const reference = new Map();
  let excludedRoutes = 0;
  const seen = new Set();
  for (const r of read(folha,6)) {
    const at = String(r[1] || '').trim();
    if (!at) continue;
    if (seen.has(at)) throw new Error('AT duplicada na Folha 1: ' + at);
    seen.add(at);
    if (excluded.has(at)) { excludedRoutes++; continue; }
    reference.set(at,r);
  }
  const rows = [];
  const baseIds = new Set();
  const sameQuantity = (a,b) => (a === '' || a == null) && (b === '' || b == null)
    || typeof a === typeof b && a === b;
  for (const r of read(base,6)) {
    const at = String(r[1] || '').trim();
    if (!at) continue;
    if (baseIds.has(at)) throw new Error('AT duplicada na Base de Produção: ' + at);
    baseIds.add(at);
    if (excluded.has(at)) throw new Error('AT desmanchada ainda presente na Base de Produção: ' + at);
    const original = reference.get(at);
    if (!original) throw new Error('AT da Base de Produção não corresponde à Folha 1: ' + at);
    const date = lspPublicDate_(r[0]);
    if (!date || date !== lspPublicDate_(original[0]) || norm(r[2]) !== norm(original[5])
        || !sameQuantity(r[4],original[3]) || !sameQuantity(r[3],original[4])) {
      throw new Error('Base de Produção diverge da Folha 1 para a AT: ' + at);
    }
    // Mesmo mapeamento utilizado por getProductionData no aplicativo original.
    rows.push([r[0],at,'',r[4],r[3],r[2]]);
  }
  if (baseIds.size !== reference.size) {
    throw new Error('Base de Produção incompleta: base=' + baseIds.size + '; esperado=' + reference.size);
  }
  const expected = [0,0,0,0];
  for (const r of reference.values()) {
    const status = norm(r[5]);
    const out = status === 'expedida' || status === 'completa';
    const floor = status === 'audit completo' || status === 'pendente de audit';
    if (!out && !floor) throw new Error('Status inesperado na Folha 1: ' + status);
    const offset = out ? 0 : 2;
    expected[offset]++;
    if (lspPublicNumber_(r[3])) expected[offset+1] += Number(r[3]);
  }
  console.log('Produção: ' + rows.length + ' ATs; desmanchadas excluídas: ' + excludedRoutes);
  return {rows,expected,excludedRoutes};
}

