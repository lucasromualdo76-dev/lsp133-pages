/**
 * Sincronização LSP 133 -> GitHub Pages.
 * Somente indicadores por data. O GitHub Pages é público.
 *
 * Requer aprovação corporativa para publicar os indicadores.
 * Propriedades do Script (não coloque tokens neste arquivo):
 *   SOURCE_SPREADSHEET_ID = ID da planilha de origem (nunca registrar no GitHub)\n *   GITHUB_TOKEN = token fine-grained com Contents: Read and write somente em lsp133-pages
 *   PUBLICATION_APPROVED = YES (depois da aprovação para divulgação pública)
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
  const spreadsheetId = cfg.getProperty('SOURCE_SPREADSHEET_ID');\n  if (!spreadsheetId) throw new Error('Configure SOURCE_SPREADSHEET_ID nas Propriedades do script.');\n  const ss = SpreadsheetApp.openById(spreadsheetId);
  const p = ss.getSheetByName('Base de Produção');
  const e = ss.getSheetByName('Resumo de Expedição');
  if (!p || !e) throw new Error('Não encontrei Base de Produção ou Resumo de Expedição.');
  const map = new Map(), atSet = new Set();
  const make = date => {
    if (!map.has(date)) map.set(date,{
      date,routesOut:0,routesFloor:0,packagesOut:0,packagesFloor:0,
      pendingPackagesOut:0,pendingPackagesFloor:0,assigned:0,complete:0,assignedTotal:0
    });
    return map.get(date);
  };
  const pr = p.getLastRow()>1 ? p.getRange(2,1,p.getLastRow()-1,6).getValues() : [];
  for (const r of pr) {
    const at=String(r[1]||'').trim();if (!at) continue;
    const date=lspPublicDate_(r[0]);
    if (!date) throw new Error('Data ausente na Base de Produção: interrompido.');
    if (atSet.has(at)) throw new Error('AT duplicada na Base: interrompido.');
    atSet.add(at);
    const x=make(date),st=String(r[2]||'').trim().toLowerCase();
    if (st==='expedida' || st==='completa') {
      x.routesOut++;
      if (lspPublicNumber_(r[4])) x.packagesOut+=Number(r[4]);
      else x.pendingPackagesOut++;
    } else if (st==='audit completo' || st==='pendente de audit') {
      x.routesFloor++;
      if (lspPublicNumber_(r[3])) x.packagesFloor+=Number(r[3]);
      else x.pendingPackagesFloor++;
    }
  }
  if (atSet.size===0) throw new Error('Base vazia; publicação interrompida.');
  const er=e.getLastRow()>3?e.getRange(4,1,e.getLastRow()-3,4).getValues():[];
  const dateSet=new Set();
  for (const r of er) {
    const date=lspPublicDate_(r[0]);if (!date) continue;
    const a=Number(r[1]),c=Number(r[2]),t=Number(r[3]);
    if (![a,c,t].every(n=>Number.isInteger(n)&&n>=0)||a+c!==t) throw new Error('Totais de atribuição inconsistentes em '+date);
    if (dateSet.has(date)) throw new Error('Data repetida no resumo de atribuições: '+date);
    dateSet.add(date);const x=make(date);x.assigned=a;x.complete=c;x.assignedTotal=t;
  }
  const days=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const body={mode:'REAL_AGGREGATED',schemaVersion:1,generatedAt:new Date().toISOString(),
    source:'Validação de Dados / Base de Produção / Resumo de Expedição',
    coverage:{routes:atSet.size,assignmentDays:dateSet.size},days};
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
  console.log('Publicado JSON agregado: '+days.length+' datas; '+atSet.size+' rotas na base');
}
function installLsp133SyncTrigger() {
  ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()==='syncLsp133ToGitHub').forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger('syncLsp133ToGitHub').timeBased().everyMinutes(15).create();
}
function stopLsp133SyncTrigger() {
  ScriptApp.getProjectTriggers().filter(x=>x.getHandlerFunction()==='syncLsp133ToGitHub').forEach(ScriptApp.deleteTrigger);
}
