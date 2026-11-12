/**
 * Sincronização LSP 133 -> GitHub Pages.
 * Somente indicadores por data. O GitHub Pages é público.
 *
 * Requer aprovação corporativa para publicar os indicadores.
 * Propriedades do Script (não coloque tokens neste arquivo):
 *   SOURCE_SPREADSHEET_ID = ID da planilha de origem (nunca registrar no GitHub)
 *   GITHUB_TOKEN = token fine-grained com Contents: Read and write somente em lsp133-pages
 *   PUBLICATION_APPROVED = YES (depois da aprovação para divulgação pública)
 *   INSUCESSOS_SPREADSHEET_ID = ID opcional da planilha de insucessos
 *   ERROS_SPREADSHEET_ID = ID opcional da planilha de erros
 *
 * Execute syncLsp133ToGitHub para testar.
 * Depois execute installLsp133SyncTrigger para atualizar a cada 15 minutos.
 */
const LSP133_PUBLIC = {
  repo: 'lucasromualdo76-dev/lsp133-pages',
  path: 'data/indicadores.json'
};
function lspPublicDate_(x) {
  if (x instanceof Date && !isNaN(x)) return Utilities.formatDate(x,'America/Sao_Paulo','yyyy-MM-dd');
  const m = String(x || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3]+'-'+m[2]+'-'+m[1] : null;
}
function lspPublicNumber_(v) { return v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0; }
function syncLsp133ToGitHub() {
  const cfg = PropertiesService.getScriptProperties();
  if (cfg.getProperty('PUBLICATION_APPROVED') !== 'YES') {
    throw new Error('Publicação pública ainda não autorizada. Obtenha aprovação corporativa para divulgar os indicadores.');
  }
  const token = cfg.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Configure GITHUB_TOKEN nas Propriedades do script.');
  const spreadsheetId = cfg.getProperty('SOURCE_SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Configure SOURCE_SPREADSHEET_ID nas Propriedades do script.');
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const p = ss.getSheetByName('Folha 1');
  const e = ss.getSheetByName('Resumo de Expedição');
  if (!p || !e) throw new Error('Não encontrei Folha 1 ou Resumo de Expedição.');
  const map = new Map(), atSet = new Set();
  const make = date => {
    if (!map.has(date)) map.set(date,{
      date,routesOut:0,routesFloor:0,packagesOut:0,packagesFloor:0,
      pendingPackagesOut:0,pendingPackagesFloor:0,assigned:0,complete:0,assignedTotal:0
    });
    return map.get(date);
  };
  // Fonte dos quatro KPIs: Folha 1!A:F. Repete as formulas da Folha 1!G2:J2:
  // Status em F; pacotes efetivamente bipados/expedidos em D.
  // ATs desmanchadas permanecem contadas conforme a dashboard original.
  const pr = p.getLastRow()>1 ? p.getRange(2,1,p.getLastRow()-1,6).getValues() : [];
  for (const r of pr) {
    const at=String(r[1]||'').trim();if (!at) continue;
    const date=lspPublicDate_(r[0]);
    if (!date) throw new Error('Data ausente na Folha 1: interrompido.');
    if (atSet.has(at)) throw new Error('AT duplicada na Folha 1: interrompido.');
    atSet.add(at);
    const x=make(date),st=String(r[5]||'').trim().toLowerCase();
    if (st==='expedida' || st==='completa') {
      x.routesOut++;
      if (lspPublicNumber_(r[3])) x.packagesOut+=Number(r[3]);
      else x.pendingPackagesOut++;
    } else if (st==='audit completo' || st==='pendente de audit') {
      x.routesFloor++;
      if (lspPublicNumber_(r[3])) x.packagesFloor+=Number(r[3]);
      else x.pendingPackagesFloor++;
    } else {
      throw new Error('Status inesperado na Folha 1: '+st);
    }
  }
  if (atSet.size===0) throw new Error('Folha 1 vazia; publicação interrompida.');
  const er=e.getLastRow()>3?e.getRange(4,1,e.getLastRow()-3,4).getValues():[];
  const dateSet=new Set();
  for (const r of er) {
    const date=lspPublicDate_(r[0]);if (!date) continue;
    const a=Number(r[1]),c=Number(r[2]),t=Number(r[3]);
    if (![a,c,t].every(n=>Number.isInteger(n)&&n>=0)||a+c!==t) throw new Error('Totais de atribuição inconsistentes em '+date);
    if (dateSet.has(date)) throw new Error('Data repetida no resumo de atribuições: '+date);
    dateSet.add(date);const x=make(date);x.assigned=a;x.complete=c;x.assignedTotal=t;
  }
  // Bloqueia publicacao se os KPIs nao baterem exatamente com o painel original.
  const actual=p.getRange('G2:J2').getValues()[0].map(Number);
  const days=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const measured=['routesOut','packagesOut','routesFloor','packagesFloor'].map(k=>days.reduce((n,d)=>n+d[k],0));
  if (!actual.every((v,i)=>Number.isFinite(v)&&v===measured[i])) {
    throw new Error('Divergencia entre sincronizador e Folha 1 G2:J2: planilha='+JSON.stringify(actual)+'; sync='+JSON.stringify(measured));
  }
  // Historico original: ultima captura por data operacional, sem expor ATs.
  const hist=ss.getSheetByName('Histórico Diário');
  const latest=new Map();
  if(hist&&hist.getLastRow()>1){
    const h=hist.getRange(2,1,hist.getLastRow()-1,12).getValues();
    for(const row of h){
      const date=lspPublicDate_(row[1]);
      if(!date)continue;
      const stamp=row[10] instanceof Date ? row[10].toISOString() : String(row[10]||'');
      const prev=latest.get(date);
      if(prev&&prev.stamp>stamp)continue;
      latest.set(date,{stamp,date,
        routesOut:Number(row[2])||0,routesFloor:Number(row[3])||0,
        packagesOut:Number(row[4])||0,packagesFloor:Number(row[5])||0,
        pendingPackagesOut:Number(row[7])||0,pendingPackagesFloor:Number(row[8])||0,
        snapshotType:String(row[9]||''),snapshotAt:stamp});
    }
  }
  const history=[...latest.values()].sort((a,b)=>a.date.localeCompare(b.date));
  // As outras fontes sao opcionais; somente totais diarios, sem BR, AT ou dados pessoais.
  const extras={};
  const insId=cfg.getProperty('INSUCESSOS_SPREADSHEET_ID');
  if(insId){
    const insSS=SpreadsheetApp.openById(insId),dashboard=insSS.getSheetByName('Dashboard');
    if(!dashboard)throw new Error('A planilha Insucessos nao possui aba Dashboard.');
    const metrics=dashboard.getRange('A5:J5').getDisplayValues()[0];
    const details=dashboard.getRange(9,1,Math.max(1,dashboard.getLastRow()-8),2).getDisplayValues();
    const insDays=details.map(r=>({date:lspPublicDate_(r[0]),returns:Number(String(r[1]).replace(/[^0-9]/g,''))||0}))
      .filter(r=>r.date&&r.returns>=0);
    extras.insucessos={uniqueReturns:Number(String(metrics[3]).replace(/[^0-9]/g,''))||0,
      flying:Number(String(metrics[6]).replace(/[^0-9]/g,''))||0,
      other:Number(String(metrics[9]).replace(/[^0-9]/g,''))||0,
      flyingRate:String(metrics[0]||'—'),daily:insDays};
  }
  const errosId=cfg.getProperty('ERROS_SPREADSHEET_ID');
  if(errosId){
    const errorsSS=SpreadsheetApp.openById(errosId),base=errorsSS.getSheetByName('Base Erros Consolidada');
    if(!base)throw new Error('A planilha de erros nao possui aba Base Erros Consolidada.');
    const erows=base.getLastRow()>1 ? base.getRange(2,1,base.getLastRow()-1,3).getDisplayValues() : [];
    const dailyErrors=new Map(),occurrences=new Set();
    let labelErrors=0,otherErrors=0;
    for(const r of erows){
      const date=lspPublicDate_(r[0]),br=String(r[1]||'').trim(),type=String(r[2]||'').trim();
      if(!date||!br||!type)continue;
      const key=date+'|'+br+'|'+type;if(occurrences.has(key))continue;occurrences.add(key);
      if(!dailyErrors.has(date))dailyErrors.set(date,{date,labelErrors:0,otherErrors:0});
      const row=dailyErrors.get(date);
      if(type.toLowerCase().includes('etiqueta')){labelErrors++;row.labelErrors++;}
      else {otherErrors++;row.otherErrors++;}
    }
    extras.erros={labelErrors,otherErrors,total:labelErrors+otherErrors,
      daily:[...dailyErrors.values()].sort((a,b)=>a.date.localeCompare(b.date))};
  }
  const body={mode:'REAL_AGGREGATED',schemaVersion:1,generatedAt:new Date().toISOString(),
    source:'Validação de Dados / Folha 1 / Resumo de Expedição',
    coverage:{routes:atSet.size,assignmentDays:dateSet.size},days,history,...extras};
  const url='https://api.github.com/repos/'+LSP133_PUBLIC.repo+'/contents/'+LSP133_PUBLIC.path;
  const headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  const prior=UrlFetchApp.fetch(url,{headers,muteHttpExceptions:true});
  let sha;
  if(prior.getResponseCode()===200) sha=JSON.parse(prior.getContentText()).sha;
  else if(prior.getResponseCode()!==404) throw new Error('GitHub leitura: HTTP '+prior.getResponseCode());
  const payload={message:'data: atualizar indicadores agregados da operação',branch:'main',
    content:Utilities.base64Encode(JSON.stringify(body,null,2),Utilities.Charset.UTF_8)};
  if(sha) payload.sha=sha;
  const updated=UrlFetchApp.fetch(url,{method:'put',headers:{...headers,'Content-Type':'application/json'},
    payload:JSON.stringify(payload),muteHttpExceptions:true});
  if (![200,201].includes(updated.getResponseCode())) throw new Error('GitHub escrita: HTTP '+updated.getResponseCode()+' '+updated.getContentText().slice(0,250));
  console.log('Publicado JSON agregado: '+days.length+' datas; '+atSet.size+' rotas na Folha 1');
}
function installLsp133SyncTrigger() {
  ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()==='syncLsp133ToGitHub').forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('syncLsp133ToGitHub').timeBased().everyMinutes(15).create();
}
function stopLsp133SyncTrigger() {
  ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()==='syncLsp133ToGitHub').forEach(ScriptApp.deleteTrigger);
}
